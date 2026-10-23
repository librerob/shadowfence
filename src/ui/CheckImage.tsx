import { useEffect, useRef, useState } from "react";
import { addImage, type Fingerprint } from "../core/model";
import { imageMatches } from "../core/matching";
import { analyzeImage } from "../image/client";
import type { Vault } from "./useVault";
import { FileDrop, Notice } from "./components";
import { Icon } from "./Icon";

export function CheckImage({ vault }: { vault: Vault }) {
  const [fp, setFp] = useState<Fingerprint | null>(null),
    [preview, setPreview] = useState(""),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const selected = vault.data.identities.find(
    (i) => i.id === vault.data.currentId,
  )!;
  const matches = fp
    ? imageMatches(fp, vault.data.identities, selected.id)
    : [];
  const exact = matches.some((m) => m.kind === "exact");
  const referenceCount = vault.data.identities.reduce(
    (count, identity) =>
      count + (identity.id === selected.id ? 0 : identity.images.length),
    0,
  );
  const registered = fp && selected.images.some((i) => i.sha256 === fp.sha256);
  async function check(files: File[]) {
    const file = files[0];
    if (!file || busy) return;
    setBusy(true);
    setError("");
    setFp(null);
    setPreview("");
    setMessage("");
    setName(file.name);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const result = await analyzeImage(file, controller.signal);
      if (controller.signal.aborted) return;
      setFp(result);
      setPreview(URL.createObjectURL(file));
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  async function register() {
    if (!fp) return;
    setError("");
    try {
      await vault.update((data) => addImage(data, selected.id, fp).data);
      setMessage(`Registered under ${selected.name}.`);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">Before you share</span>
          <h1>Check an image</h1>
          <p>Look for reuse across your other identities.</p>
        </div>
        <span className="local-label">
          <Icon name="lock" size={16} />
          On-device processing
        </span>
      </div>
      <FileDrop
        onFiles={(files) => void check(files)}
        busy={busy || vault.busy}
        compact={!!fp}
      />
      {busy && (
        <div className="progress" role="status">
          <progress />
          Comparing local fingerprints…
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {fp && (
        <section className="result" aria-live="polite">
          <div className="result-file">
            <img src={preview} alt="Selected image preview" />
            <div>
              <strong>{name}</strong>
              <span>Checking as {selected.name}</span>
            </div>
            <button
              className="text-button"
              onClick={() => {
                setFp(null);
                setPreview("");
                setName("");
                setMessage("");
              }}
            >
              Clear
            </button>
          </div>
          <Notice
            tone={
              !referenceCount
                ? "info"
                : exact
                  ? "error"
                  : matches.length
                    ? "warning"
                    : "success"
            }
          >
            <h2>
              {!referenceCount
                ? "No reference images to compare"
                : exact
                  ? "Identity collision detected"
                  : matches.length
                    ? "Possible identity collision"
                    : "No cross-identity matches detected."}
            </h2>
            <p>
              {!referenceCount
                ? "Add reference images under another identity to check for cross-identity reuse. Images registered only under your current identity are excluded."
                : exact
                  ? "This exact file is registered under another identity. Sharing it here could link the two."
                  : matches.length
                    ? "This image resembles material registered under another identity. Review the match before sharing."
                    : "No match was found in your registered images. This does not guarantee anonymity."}
            </p>
          </Notice>
          {matches.map((m) => (
            <div className="match-row" key={m.identity.id + m.image.id}>
              <span className={`avatar ${m.identity.color}`}>
                {m.identity.name[0].toUpperCase()}
              </span>
              <div>
                <strong>{m.identity.name}</strong>
                <small>
                  {m.image.label || "Registered image"} ·{" "}
                  {m.kind === "exact"
                    ? "Exact file (SHA-256)"
                    : "Visually similar (pHash + dHash)"}
                </small>
              </div>
            </div>
          ))}
          {fp.detail < 8 && (
            <Notice tone="warning">
              This image has little visual detail. Only exact file matches are
              reported; perceptual matching would be unreliable.
            </Notice>
          )}
          {!!referenceCount && (
            <p className="caption">
              Compared against {referenceCount} registered image
              {referenceCount === 1 ? "" : "s"} under other identities.
            </p>
          )}
          {registered ? (
            <p className="registered">
              <Icon name="check" />
              {matches.length
                ? "Also registered here. Cross-identity reuse remains visible."
                : `Already registered under ${selected.name}.`}
            </p>
          ) : (
            <div className="result-actions">
              <p>
                {matches.length
                  ? "If this reuse is intentional, you can register it here too. The connection will remain visible."
                  : "Keep this fingerprint as a reference for future checks."}
              </p>
              <button
                className="tonal"
                disabled={vault.busy}
                onClick={() => void register()}
              >
                <Icon name="plus" />
                {matches.length
                  ? "Register intentional reuse"
                  : `Register under ${selected.name}`}
              </button>
            </div>
          )}
          {message && <p role="status">{message}</p>}
        </section>
      )}
      <div className="quiet-note">
        <Icon name="info" />
        <p>
          ShadowFence compares against images you have registered. Crops,
          rotations and screenshots may go undetected. It does not recognize
          faces or search the internet.
        </p>
      </div>
    </>
  );
}
