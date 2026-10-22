import { useState, type FormEvent } from "react";
import { identityColors } from "../core/model";
import type { Vault } from "./useVault";
import { Dialog, Notice } from "./components";
import { Icon } from "./Icon";

export type Appearance = {
  mode: "system" | "light" | "dark" | "amoled";
  accent: (typeof identityColors)[number];
};
export function readAppearance(): Appearance {
  try {
    const x = JSON.parse(
      localStorage.getItem("shadowfence.appearance") || "{}",
    );
    return {
      mode: ["system", "light", "dark", "amoled"].includes(x.mode)
        ? x.mode
        : "system",
      accent: identityColors.includes(x.accent) ? x.accent : "violet",
    };
  } catch {
    return { mode: "system", accent: "violet" };
  }
}
export function applyAppearance(value: Appearance) {
  document.documentElement.dataset.theme = value.mode;
  document.documentElement.dataset.accent = value.accent;
  localStorage.setItem("shadowfence.appearance", JSON.stringify(value));
}
export function Settings({ vault }: { vault: Vault }) {
  const [appearance, setAppearance] = useState(readAppearance),
    [pass, setPass] = useState(""),
    [confirm, setConfirm] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [erasing, setErasing] = useState(false);
  const change = (next: Appearance) => {
    try {
      applyAppearance(next);
      setAppearance(next);
    } catch {
      setError("Appearance could not be saved. Local storage is unavailable.");
    }
  };
  const exportBackup = () => {
    const envelope = vault.backup();
    if (!envelope) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(envelope)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "shadowfence-encrypted-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Encrypted backup downloaded. Keep the passphrase separately.");
  };
  const changePass = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      if (pass !== confirm) throw new Error("The passphrases do not match.");
      const secret = pass;
      setPass("");
      setConfirm("");
      await vault.changePassphrase(secret);
      setMessage(
        "Passphrase changed. Existing backups still use their old passphrase.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">Make it yours</span>
          <h1>Settings</h1>
          <p>Appearance, encryption and your local data.</p>
        </div>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {message && (
        <div role="status">
          <Notice tone="success">{message}</Notice>
        </div>
      )}
      <section className="settings-section">
        <h2>Appearance</h2>
        <p>System follows your browser’s available light or dark preference.</p>
        <fieldset className="appearance-field">
          <legend>Theme</legend>
          <div className="theme-options">
            {(["system", "light", "dark", "amoled"] as const).map((mode) => (
              <button
                key={mode}
                className={`theme-option ${mode}`}
                aria-pressed={appearance.mode === mode}
                onClick={() => change({ ...appearance, mode })}
              >
                <span className="theme-preview">
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  {mode === "amoled"
                    ? "AMOLED"
                    : mode[0].toUpperCase() + mode.slice(1)}
                  {appearance.mode === mode && <Icon name="check" size={16} />}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="color-field">
          <legend>Accent color</legend>
          <div className="accent-options">
            {identityColors.map((accent) => (
              <button
                key={accent}
                className="accent-option"
                aria-pressed={appearance.accent === accent}
                onClick={() => change({ ...appearance, accent })}
              >
                <span className={`swatch ${accent}`}>
                  {appearance.accent === accent && (
                    <Icon name="check" size={18} />
                  )}
                </span>
                <span>{accent[0].toUpperCase() + accent.slice(1)}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <p className="caption">
          Chrome does not expose its exact toolbar accent to ordinary
          extensions. These locally defined color roles are a manual
          approximation.
        </p>
      </section>
      <section className="settings-section">
        <h2>Vault security</h2>
        <p>
          Your vault locks after 5 minutes without interaction and when this tab
          closes. Every tab must be unlocked separately. Locking here locks all
          open ShadowFence tabs.
        </p>
        <button className="tonal" onClick={() => vault.lock()}>
          <Icon name="lock" />
          Lock vault now
        </button>
        <h3 className="subheading">Change passphrase</h3>
        <form onSubmit={(e) => void changePass(e)} className="passphrase-form">
          <label>
            New passphrase
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={1024}
              required
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
          </label>
          <label>
            Confirm new passphrase
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={1024}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          <button className="tonal" disabled={vault.busy}>
            Update passphrase
          </button>
        </form>
      </section>
      <section className="settings-section">
        <h2>Your data</h2>
        <div className="settings-row">
          <div>
            <h3>Encrypted backup</h3>
            <p>
              Download your encrypted vault. Restore it from the welcome screen
              in a fresh installation. No photographs are included.
            </p>
          </div>
          <button
            className="tonal"
            onClick={exportBackup}
            disabled={vault.busy}
          >
            Export backup
          </button>
        </div>
        <div className="settings-row">
          <div>
            <h3>Delete local vault</h3>
            <p>
              Remove all identities, fingerprints and identifiers from this
              browser. Export a backup first if you want to keep them.
            </p>
          </div>
          <button
            className="text-button danger-text"
            onClick={() => setErasing(true)}
            disabled={vault.busy}
          >
            Delete vault
          </button>
        </div>
      </section>
      {erasing && (
        <Dialog
          title="Delete your local vault?"
          onClose={() => setErasing(false)}
        >
          <p>
            This permanently removes the vault from this browser. Downloaded
            backups are separate and will remain on your device.
          </p>
          <div className="dialog-actions">
            <button className="text-button" onClick={() => setErasing(false)}>
              Keep vault
            </button>
            <button
              className="danger"
              disabled={vault.busy}
              onClick={async () => {
                try {
                  await vault.erase();
                } catch (e) {
                  setError((e as Error).message);
                  setErasing(false);
                }
              }}
            >
              Delete vault permanently
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
