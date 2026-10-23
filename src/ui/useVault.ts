import { useEffect, useRef, useState } from "react";
import {
  checkPassphrase,
  deriveKey,
  newSalt,
  seal,
  validateEnvelope,
  type Envelope,
} from "../core/crypto";
import { emptyVault, validateData, type VaultData } from "../core/model";
import { readEnvelope, writeEnvelope } from "../core/storage";
import { Inactivity } from "../core/inactivity";
import { unlockRecord } from "../core/unlock";
import { currentKdf } from "../kdf/policy";

export function useVault() {
  const [status, setStatus] = useState<
    "loading" | "setup" | "locked" | "open" | "damaged"
  >("loading");
  const [data, setData] = useState<VaultData>(emptyVault);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const session = useRef<{
    key: CryptoKey;
    envelope: Envelope;
    data: VaultData;
  } | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const inactivity = useRef(new Inactivity());
  const operation = useRef<AbortController | null>(null);
  const epoch = useRef(0),
    working = useRef(false);
  const lockRef = useRef<() => void>(() => {});
  const lock = (broadcast = true) => {
    epoch.current++;
    operation.current?.abort();
    session.current = null;
    setData(emptyVault());
    setError("");
    setStatus("locked");
    if (broadcast) channel.current?.postMessage("lock");
  };
  lockRef.current = () => lock();
  useEffect(() => {
    let alive = true;
    void readEnvelope()
      .then((envelope) => {
        if (alive) setStatus(envelope ? "locked" : "setup");
      })
      .catch((e) => {
        if (alive) {
          setError(e.message);
          setStatus("damaged");
        }
      });
    const bc = new BroadcastChannel("shadowfence.vault");
    channel.current = bc;
    bc.onmessage = () => {
      if (alive) lock(false);
    };
    const expire = () => {
      if (!session.current || !inactivity.current.expired(Date.now()))
        return false;
      lockRef.current();
      return true;
    };
    const activity = (e: Event) => {
      if (!e.isTrusted || !session.current) return;
      if (expire()) {
        e.preventDefault();
        e.stopImmediatePropagation();
      } else inactivity.current.activity(Date.now());
    };
    window.addEventListener("pointerdown", activity, true);
    window.addEventListener("keydown", activity, true);
    const visibility = () => {
      // Test the previous hidden interval before clearing it on return.
      if (!expire()) inactivity.current.visibility(Date.now(), document.hidden);
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", expire);
    const timer = setInterval(expire, 1000);
    const onPageHide = () => lock(false);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      alive = false;
      epoch.current++;
      operation.current?.abort();
      session.current = null;
      bc.close();
      clearInterval(timer);
      window.removeEventListener("pointerdown", activity, true);
      window.removeEventListener("keydown", activity, true);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", expire);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);
  async function task<T>(fn: (token: number) => Promise<T>): Promise<T> {
    if (session.current && inactivity.current.expired(Date.now())) {
      lock();
      throw new Error("Your session expired. Unlock your vault to continue.");
    }
    if (working.current)
      throw new Error("Please wait for the current change to finish.");
    working.current = true;
    setBusy(true);
    setError("");
    const token = epoch.current;
    operation.current = new AbortController();
    try {
      return await fn(token);
    } finally {
      operation.current = null;
      working.current = false;
      setBusy(false);
    }
  }
  function ensure(token: number) {
    if (token !== epoch.current)
      throw new Error("The vault was locked. Unlock it to continue.");
  }
  const unlock = (passphrase: string, create = false) =>
    task(async (token) => {
      const existing = await readEnvelope();
      if (create && existing)
        throw new Error(
          "A vault already exists. Reload this page to unlock it.",
        );
      if (create) checkPassphrase(passphrase);
      if (!create && !existing)
        throw new Error("No vault exists. Reload this page to create one.");
      const {
        key,
        envelope,
        data: value,
        changed,
      } = await unlockRecord(passphrase, existing, operation.current?.signal);
      ensure(token);
      if (changed) {
        await writeEnvelope(envelope, existing?.revision ?? null);
        channel.current?.postMessage("changed");
      }
      ensure(token);
      session.current = { key, envelope, data: value };
      inactivity.current.reset(Date.now(), document.hidden);
      setData(value);
      setStatus("open");
    });
  const update = (transform: (data: VaultData) => VaultData) =>
    task(async (token) => {
      const current = session.current;
      if (!current) throw new Error("Unlock your vault first.");
      const next = validateData(transform(structuredClone(current.data)));
      const envelope = await seal(
        next,
        current.key,
        current.envelope.salt,
        currentKdf,
      );
      ensure(token);
      await writeEnvelope(envelope, current.envelope.revision);
      ensure(token);
      session.current = { ...current, data: next, envelope };
      setData(next);
      channel.current?.postMessage("changed");
    });
  const changePassphrase = (passphrase: string) =>
    task(async (token) => {
      const current = session.current;
      if (!current) throw new Error("Unlock your vault first.");
      checkPassphrase(passphrase);
      const salt = newSalt(),
        key = await deriveKey(
          passphrase,
          salt,
          currentKdf,
          operation.current?.signal,
        ),
        envelope = await seal(current.data, key, salt, currentKdf);
      ensure(token);
      await writeEnvelope(envelope, current.envelope.revision);
      ensure(token);
      session.current = { ...current, key, envelope };
      channel.current?.postMessage("changed");
    });
  const restore = (input: unknown, passphrase: string) =>
    task(async (token) => {
      const {
        key,
        envelope,
        data: value,
      } = await unlockRecord(
        passphrase,
        validateEnvelope(input),
        operation.current?.signal,
      );
      ensure(token);
      await writeEnvelope(envelope, null);
      ensure(token);
      session.current = { key, envelope, data: value };
      inactivity.current.reset(Date.now(), document.hidden);
      setData(value);
      setStatus("open");
      channel.current?.postMessage("changed");
    });
  const erase = () =>
    task(async (token) => {
      const current = session.current;
      if (!current) throw new Error("Unlock your vault first.");
      ensure(token);
      await writeEnvelope(null, current.envelope.revision);
      lock();
      setStatus("setup");
    });
  return {
    status,
    data,
    error,
    setError,
    busy,
    unlock,
    update,
    lock,
    restore,
    changePassphrase,
    erase,
    backup: () => {
      if (session.current && inactivity.current.expired(Date.now())) {
        lock();
        return null;
      }
      return session.current?.envelope ?? null;
    },
  };
}
export type Vault = ReturnType<typeof useVault>;
