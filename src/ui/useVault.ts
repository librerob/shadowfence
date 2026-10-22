import { useEffect, useRef, useState } from "react";
import {
  checkPassphrase,
  deriveKey,
  newSalt,
  open,
  seal,
  validateEnvelope,
  type Envelope,
} from "../core/crypto";
import { emptyVault, validateData, type VaultData } from "../core/model";
import { readEnvelope, writeEnvelope } from "../core/storage";

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
  const epoch = useRef(0),
    working = useRef(false);
  const lockRef = useRef<() => void>(() => {});
  const lock = (broadcast = true) => {
    epoch.current++;
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
    let last = Date.now();
    const activity = (e: Event) => {
      if (e.isTrusted) last = Date.now();
    };
    window.addEventListener("pointerdown", activity);
    window.addEventListener("keydown", activity);
    const timer = setInterval(() => {
      if (session.current && Date.now() - last > 300000) lockRef.current();
    }, 1000);
    const onPageHide = () => lock(false);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      alive = false;
      epoch.current++;
      session.current = null;
      bc.close();
      clearInterval(timer);
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);
  async function task<T>(fn: (token: number) => Promise<T>): Promise<T> {
    if (working.current)
      throw new Error("Please wait for the current change to finish.");
    working.current = true;
    setBusy(true);
    setError("");
    const token = epoch.current;
    try {
      return await fn(token);
    } finally {
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
      const salt = existing?.salt ?? newSalt();
      const key = await deriveKey(passphrase, salt);
      const value = existing ? await open(existing, key) : emptyVault();
      const envelope = existing ?? (await seal(value, key, salt));
      ensure(token);
      if (!existing) await writeEnvelope(envelope, null);
      ensure(token);
      session.current = { key, envelope, data: value };
      setData(value);
      setStatus("open");
    });
  const update = (transform: (data: VaultData) => VaultData) =>
    task(async (token) => {
      const current = session.current;
      if (!current) throw new Error("Unlock your vault first.");
      const next = validateData(transform(structuredClone(current.data)));
      const envelope = await seal(next, current.key, current.envelope.salt);
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
        key = await deriveKey(passphrase, salt),
        envelope = await seal(current.data, key, salt);
      ensure(token);
      await writeEnvelope(envelope, current.envelope.revision);
      ensure(token);
      session.current = { ...current, key, envelope };
      channel.current?.postMessage("changed");
    });
  const restore = (input: unknown, passphrase: string) =>
    task(async (token) => {
      const envelope = validateEnvelope(input),
        key = await deriveKey(passphrase, envelope.salt),
        value = await open(envelope, key);
      ensure(token);
      await writeEnvelope(envelope, null);
      ensure(token);
      session.current = { key, envelope, data: value };
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
    backup: () => session.current?.envelope ?? null,
  };
}
export type Vault = ReturnType<typeof useVault>;
