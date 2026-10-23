import { privateText } from "./privateInput";
import { useState, type FormEvent } from "react";
import type { Vault } from "./useVault";
import { Brand, Icon } from "./Icon";
import { Notice } from "./components";

export function Unlock({ vault }: { vault: Vault }) {
  const [pass, setPass] = useState(""),
    [confirm, setConfirm] = useState(""),
    [backup, setBackup] = useState<unknown>(null);
  const setup = vault.status === "setup";
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (setup && !backup && pass !== confirm)
        throw new Error("The passphrases do not match.");
      const secret = pass;
      setPass("");
      setConfirm("");
      if (backup) await vault.restore(backup, secret);
      else await vault.unlock(secret, setup);
    } catch (e) {
      vault.setError((e as Error).message);
    }
  };
  return (
    <div className="unlock-shell">
      <header>
        <Brand />
        <span className="caption">Local by design</span>
      </header>
      <main className="unlock-layout">
        <div className="welcome-copy">
          <span className="eyebrow">A little space between identities</span>
          <h1>
            Keep your separate
            <br />
            lives separate.
          </h1>
          <p>
            Before you share a photo or a piece of text, check whether it
            belongs to another part of your life.
          </p>
          <div className="boundary-art" aria-hidden="true">
            <div className="boundary-left" />
            <div className="boundary-line" />
            <div className="boundary-right" />
          </div>
          <div className="welcome-note">
            <Icon name="lock" />
            <p>
              Your images stay on your device.
              <br />
              No accounts, uploads or telemetry.
            </p>
          </div>
        </div>
        <section className="unlock-panel">
          <span className="tonal-icon">
            <Icon name="lock" size={24} />
          </span>
          <h2>
            {setup
              ? backup
                ? "Restore your vault"
                : "Your private workspace"
              : "Welcome back"}
          </h2>
          <p>
            {setup
              ? backup
                ? "Enter the passphrase used for this encrypted backup."
                : "Create a passphrase to encrypt your identities, image fingerprints and identifiers."
              : "Unlock your vault to check content and manage your identities."}
          </p>
          {vault.status === "loading" ? (
            <p role="status">Opening local storage…</p>
          ) : vault.status === "damaged" ? (
            <Notice tone="error">
              {vault.error} Your stored record has not been changed.
            </Notice>
          ) : (
            <form onSubmit={(e) => void submit(e)}>
              <label>
                Passphrase
                <input
                  {...privateText}
                  autoFocus
                  type="password"
                  autoComplete={setup ? "new-password" : "current-password"}
                  value={pass}
                  maxLength={1024}
                  onChange={(e) => setPass(e.target.value)}
                  required
                  minLength={setup && !backup ? 12 : 1}
                />
              </label>
              {setup && !backup && (
                <label>
                  Confirm passphrase
                  <input
                    {...privateText}
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    maxLength={1024}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={12}
                  />
                </label>
              )}
              {vault.error && <Notice tone="error">{vault.error}</Notice>}
              <button className="filled wide" disabled={vault.busy}>
                {vault.busy
                  ? "Opening…"
                  : setup
                    ? backup
                      ? "Restore vault"
                      : "Create encrypted vault"
                    : "Unlock vault"}
                <Icon name="arrow" />
              </button>
              <p className="caption">
                {setup && !backup
                  ? "Use at least 12 characters. There is no passphrase recovery."
                  : "Locks after 5 minutes idle, 1 minute hidden, or when this tab closes."}
              </p>
            </form>
          )}
          {setup && (
            <div className="restore">
              <label className="file-link">
                {backup
                  ? "Choose a different backup"
                  : "Have a backup? Restore an encrypted vault"}
                <input
                  type="file"
                  accept=".json"
                  hidden
                  disabled={vault.busy}
                  onChange={async (e) => {
                    try {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 12_000_000)
                        throw new Error("This backup exceeds the 12 MB limit.");
                      setBackup(JSON.parse(await file.text()));
                      vault.setError("");
                    } catch (e) {
                      vault.setError((e as Error).message);
                    }
                  }}
                />
              </label>
              {!!backup && (
                <button className="text-button" onClick={() => setBackup(null)}>
                  Create a new vault instead
                </button>
              )}
            </div>
          )}
        </section>
      </main>
      <footer className="unlock-footer">
        ShadowFence {version}{" "}
        <span>
          Check content before selecting it on a website. ShadowFence does not
          intercept uploads.
        </span>
      </footer>
    </div>
  );
}
import { version } from "../version";
