import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  identityColors,
  uid,
  type Identity,
  type IdentityColor,
} from "../core/model";
import { normalize } from "../core/matching";
import type { Vault } from "./useVault";
import { Dialog, Empty, FileDrop, Notice } from "./components";
import { Icon } from "./Icon";
import { analyzeImage } from "../image/client";
import { addImage } from "../core/model";

export function IdentityForm({
  identity,
  vault,
  onClose,
}: {
  identity?: Identity;
  vault: Vault;
  onClose: () => void;
}) {
  const [name, setName] = useState(identity?.name ?? ""),
    [description, setDescription] = useState(identity?.description ?? ""),
    [color, setColor] = useState<IdentityColor>(identity?.color ?? "violet"),
    [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (!name.trim()) throw new Error("Give this identity a name.");
      await vault.update((data) => {
        if (
          data.identities.some(
            (i) =>
              i.id !== identity?.id &&
              normalize(i.name) === normalize(name.trim()),
          )
        )
          throw new Error("An identity with this name already exists.");
        if (identity) {
          const target = data.identities.find((i) => i.id === identity.id);
          if (!target) throw new Error("Identity no longer exists.");
          Object.assign(target, {
            name: name.trim(),
            description: description.trim(),
            color,
          });
        } else {
          const id = uid();
          data.identities.push({
            id,
            name: name.trim(),
            description: description.trim(),
            color,
            images: [],
            identifiers: [],
          });
          data.currentId = id;
        }
        return data;
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Dialog
      title={identity ? "Edit identity" : "Create identity"}
      onClose={onClose}
    >
      <form onSubmit={(e) => void submit(e)}>
        <label>
          Name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Personal, Anonymous, Work"
            required
            maxLength={60}
          />
        </label>
        <label>
          Description <span className="caption">Optional</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={240}
            rows={2}
          />
        </label>
        <fieldset className="color-field">
          <legend>Identity color</legend>
          <div className="swatches">
            {identityColors.map((c) => (
              <button
                key={c}
                type="button"
                className={`swatch ${c}`}
                aria-label={c}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
              >
                {color === c && <Icon name="check" size={18} />}
              </button>
            ))}
          </div>
        </fieldset>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="dialog-actions">
          <button type="button" className="text-button" onClick={onClose}>
            Cancel
          </button>
          <button className="filled" disabled={vault.busy}>
            {identity ? "Save changes" : "Create identity"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function Identities({
  vault,
  onCreate,
}: {
  vault: Vault;
  onCreate: () => void;
}) {
  const cancel = useRef<AbortController | null>(null);
  useEffect(() => () => cancel.current?.abort(), []);
  const [selected, setSelected] = useState(""),
    [editing, setEditing] = useState<Identity>(),
    [deleting, setDeleting] = useState(false),
    [error, setError] = useState(""),
    [progress, setProgress] = useState(""),
    [label, setLabel] = useState(""),
    [value, setValue] = useState(""),
    [editIdentifier, setEditIdentifier] = useState(""),
    [message, setMessage] = useState("");
  const identity =
    vault.data.identities.find((i) => i.id === selected) ??
    vault.data.identities[0];
  const run = async (fn: () => Promise<unknown>) => {
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const register = async (files: File[]) => {
    if (!identity || progress) return;
    if (files.length > 50) {
      setError("Add up to 50 images at a time.");
      return;
    }
    setError("");
    setMessage("");
    const controller = new AbortController();
    cancel.current = controller;
    let added = 0,
      duplicates = 0;
    const issues: string[] = [];
    try {
      for (let n = 0; n < files.length; n++) {
        if (controller.signal.aborted) return;
        setProgress(`Processing ${n + 1} of ${files.length}…`);
        try {
          const fp = await analyzeImage(files[n], controller.signal);
          if (controller.signal.aborted) return;
          await vault.update((data) => {
            const result = addImage(data, identity.id, fp, label);
            if (result.duplicate) duplicates++;
            else added++;
            return result.data;
          });
        } catch (e) {
          issues.push(`${files[n].name}: ${(e as Error).message}`);
        }
      }
      setMessage(
        `${added} image${added === 1 ? "" : "s"} registered.${duplicates ? ` ${duplicates} already registered.` : ""}`,
      );
      if (issues.length) setError(issues.join("\n"));
    } finally {
      setProgress("");
    }
  };
  const saveIdentifier = async (e: FormEvent) => {
    e.preventDefault();
    if (!identity) return;
    await run(async () => {
      await vault.update((data) => {
        const target = data.identities.find((i) => i.id === identity.id)!;
        const trimmed = value.trim();
        if (!trimmed) throw new Error("Enter an identifier.");
        if (
          target.identifiers.some(
            (i) =>
              i.id !== editIdentifier &&
              normalize(i.value) === normalize(trimmed),
          )
        )
          throw new Error("This identifier is already registered.");
        if (editIdentifier) {
          target.identifiers = target.identifiers.map((i) =>
            i.id === editIdentifier ? { ...i, value: trimmed } : i,
          );
        } else target.identifiers.push({ id: uid(), value: trimmed });
        return data;
      });
      setValue("");
      setEditIdentifier("");
    });
  };
  if (!identity)
    return (
      <Empty
        title="Give each identity its own space"
        action={
          <button className="filled" onClick={onCreate}>
            <Icon name="plus" />
            Create identity
          </button>
        }
      >
        Start with a name, then add images and identifiers already associated
        with it.
      </Empty>
    );
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">Your boundaries</span>
          <h1>Identities</h1>
          <p>Keep a local reference of what belongs where.</p>
        </div>
        <button
          className="filled"
          onClick={onCreate}
          disabled={!!progress || vault.busy}
        >
          <Icon name="plus" />
          New identity
        </button>
      </div>
      <div className="identity-layout">
        <aside className="identity-list" aria-label="Your identities">
          {vault.data.identities.map((i) => (
            <button
              key={i.id}
              className={`identity-row ${identity.id === i.id ? "selected" : ""}`}
              onClick={() => {
                setSelected(i.id);
                setValue("");
                setEditIdentifier("");
                setError("");
                setMessage("");
              }}
              disabled={!!progress || vault.busy}
            >
              <span className={`avatar ${i.color}`}>
                {i.name.slice(0, 1).toUpperCase()}
              </span>
              <span>
                <strong>{i.name}</strong>
                <small>
                  {i.images.length} {i.images.length === 1 ? "image" : "images"}{" "}
                  · {i.identifiers.length}{" "}
                  {i.identifiers.length === 1 ? "identifier" : "identifiers"}
                </small>
              </span>
              <Icon name="arrow" size={16} />
            </button>
          ))}
        </aside>
        <div className="identity-detail">
          <div className="section-heading">
            <div>
              <h2>{identity.name}</h2>
              <p>
                {identity.description ||
                  "Images and identifiers associated with this identity."}
              </p>
            </div>
            <div className="inline-actions">
              <button
                className="icon-button"
                title="Edit identity"
                aria-label="Edit identity"
                onClick={() => setEditing(identity)}
                disabled={!!progress || vault.busy}
              >
                <Icon name="edit" />
              </button>
              <button
                className="icon-button danger-text"
                title="Delete identity"
                aria-label="Delete identity"
                onClick={() => setDeleting(true)}
                disabled={!!progress || vault.busy}
              >
                <Icon name="trash" />
              </button>
            </div>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          {message && (
            <div role="status">
              <Notice tone="success">{message}</Notice>
            </div>
          )}
          <section className="identity-section">
            <div className="section-heading">
              <h3>
                Registered images{" "}
                <span className="count">{identity.images.length}</span>
              </h3>
              <span className="caption">
                Fingerprints only. No photos stored.
              </span>
            </div>
            <label>
              Image label{" "}
              <span className="caption">Optional, applies to this batch</span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={120}
                placeholder="e.g. Garden in spring"
              />
            </label>
            <FileDrop
              multiple
              busy={!!progress || vault.busy}
              label="Add images"
              onFiles={(files) => void register(files)}
            />
            {progress && (
              <div role="status" className="progress">
                <progress />
                {progress}
              </div>
            )}
            {identity.images.map((image, index) => {
              const shared = vault.data.identities.filter(
                (i) =>
                  i.id !== identity.id &&
                  i.images.some((f) => f.sha256 === image.sha256),
              );
              return (
                <div className="record-row" key={image.id}>
                  <Icon name="image" />
                  <div>
                    <strong>
                      {image.label || `Registered image ${index + 1}`}
                    </strong>
                    <small>
                      {shared.length
                        ? `Also registered under ${shared.map((i) => i.name).join(", ")}`
                        : "SHA-256 + perceptual fingerprints"}
                    </small>
                  </div>
                  <button
                    className="icon-button"
                    title="Remove image fingerprint"
                    aria-label={`Remove ${image.label || `image ${index + 1}`}`}
                    disabled={!!progress || vault.busy}
                    onClick={() =>
                      void run(() =>
                        vault.update((data) => {
                          const i = data.identities.find(
                            (i) => i.id === identity.id,
                          )!;
                          i.images = i.images.filter((f) => f.id !== image.id);
                          return data;
                        }),
                      )
                    }
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              );
            })}
          </section>
          <section className="identity-section">
            <h3>
              Registered identifiers{" "}
              <span className="count">{identity.identifiers.length}</span>
            </h3>
            <p className="muted">
              Emails, usernames, handles, or other text you want to keep
              separate.
            </p>
            <form
              className="identifier-form"
              onSubmit={(e) => void saveIdentifier(e)}
            >
              <label>
                Identifier
                <input
                  aria-label="Identifier"
                  disabled={vault.busy || !!progress}
                  placeholder="e.g. name@example.com or @handle"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  maxLength={200}
                  required
                />
              </label>
              <button className="tonal" disabled={vault.busy || !!progress}>
                {editIdentifier ? "Save" : "Add"}
              </button>
              {editIdentifier && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setEditIdentifier("");
                    setValue("");
                  }}
                >
                  Cancel
                </button>
              )}
            </form>
            {identity.identifiers.map((i) => (
              <div className="record-row" key={i.id}>
                <Icon name="text" />
                <strong>{i.value}</strong>
                <div className="inline-actions">
                  <button
                    className="icon-button"
                    aria-label={`Edit ${i.value}`}
                    disabled={vault.busy || !!progress}
                    onClick={() => {
                      setEditIdentifier(i.id);
                      setValue(i.value);
                    }}
                  >
                    <Icon name="edit" size={18} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Remove ${i.value}`}
                    disabled={vault.busy || !!progress}
                    onClick={() =>
                      void run(() =>
                        vault.update((data) => {
                          const target = data.identities.find(
                            (i) => i.id === identity.id,
                          )!;
                          target.identifiers = target.identifiers.filter(
                            (f) => f.id !== i.id,
                          );
                          return data;
                        }),
                      )
                    }
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
      {editing && (
        <IdentityForm
          identity={editing}
          vault={vault}
          onClose={() => setEditing(undefined)}
        />
      )}
      {deleting && (
        <Dialog
          title={`Delete ${identity.name}?`}
          onClose={() => setDeleting(false)}
        >
          <p>
            Its {identity.images.length} image fingerprints and{" "}
            {identity.identifiers.length} identifiers will be removed from this
            vault. This cannot be undone.
          </p>
          <div className="dialog-actions">
            <button className="text-button" onClick={() => setDeleting(false)}>
              Keep identity
            </button>
            <button
              className="danger"
              disabled={vault.busy}
              onClick={() =>
                void run(async () => {
                  await vault.update((data) => {
                    data.identities = data.identities.filter(
                      (i) => i.id !== identity.id,
                    );
                    if (data.currentId === identity.id)
                      data.currentId = data.identities[0]?.id ?? "";
                    return data;
                  });
                  setDeleting(false);
                })
              }
            >
              Delete identity
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
