import { useState } from "react";
import { textMatches } from "../core/matching";
import type { Vault } from "./useVault";
import { Notice } from "./components";
import { Icon } from "./Icon";

export function CheckText({ vault }: { vault: Vault }) {
  const [text, setText] = useState(""),
    [checked, setChecked] = useState<string | null>(null);
  const matches =
    checked === text
      ? textMatches(text, vault.data.identities, vault.data.currentId)
      : [];
  const checkedNow = checked === text;
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">Before you post</span>
          <h1>Check text</h1>
          <p>Catch identifiers that belong to another identity.</p>
        </div>
        <span className="local-label">
          <Icon name="lock" size={16} />
          Never saved
        </span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setChecked(text);
        }}
      >
        <label>
          Text to check
          <textarea
            className="text-check"
            rows={9}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste a message, bio, or post you are about to share…"
            required
            maxLength={50000}
          />
        </label>
        <div className="form-footer">
          <span className="caption">
            Only registered identifiers are checked. Up to 50,000 characters.
          </span>
          <div className="inline-actions">
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setText("");
                setChecked(null);
              }}
            >
              Clear
            </button>
            <button className="filled" disabled={!text.trim()}>
              <Icon name="text" />
              Check text
            </button>
          </div>
        </div>
      </form>
      {checkedNow && (
        <section className="text-results" aria-live="polite">
          <Notice tone={matches.length ? "error" : "success"}>
            <h2>
              {matches.length
                ? "Cross-identity identifiers detected"
                : "No cross-identity identifiers detected."}
            </h2>
            <p>
              {matches.length
                ? "Review these identifiers before posting. They are registered under your other identities."
                : "No registered identifiers were found. Writing style, context and unregistered details can still identify you."}
            </p>
          </Notice>
          {matches.map((m) => (
            <div className="match-row" key={m.identity.id + m.identifier.id}>
              <span className={`avatar ${m.identity.color}`}>
                {m.identity.name[0].toUpperCase()}
              </span>
              <div>
                <strong>{m.identifier.value}</strong>
                <small>Registered under {m.identity.name}</small>
              </div>
            </div>
          ))}
        </section>
      )}
      <div className="quiet-note">
        <Icon name="info" />
        <p>
          Matches use Unicode normalization, case-insensitive comparison and
          token boundaries. Obfuscated text, spelling changes and translations
          can be missed. Your text is discarded when you leave this screen or
          lock the vault.
        </p>
      </div>
    </>
  );
}
