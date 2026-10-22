import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";
import type { Identity } from "../core/model";

export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function IdentitySelect({
  identities,
  value,
  onChange,
  disabled = false,
}: {
  identities: Identity[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="identity-select">
      <span>Checking as</span>
      <select
        aria-label="Current identity"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {identities.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </select>
    </label>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-mark">
        <Icon name="identities" size={28} />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "error" | "success" | "warning";
}) {
  return (
    <div
      className={`notice ${tone}`}
      role={tone === "error" ? "alert" : undefined}
    >
      <Icon
        name={
          tone === "success" ? "check" : tone === "info" ? "info" : "warning"
        }
      />
      <div>{children}</div>
    </div>
  );
}
export function FileDrop({
  onFiles,
  busy,
  multiple = false,
  compact = false,
  label = "Choose an image",
}: {
  onFiles: (files: File[]) => void;
  busy: boolean;
  multiple?: boolean;
  compact?: boolean;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null),
    area = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={area}
      className={`dropzone${compact ? " compact" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) area.current?.classList.add("dragging");
      }}
      onDragLeave={() => area.current?.classList.remove("dragging")}
      onDrop={(e) => {
        e.preventDefault();
        area.current?.classList.remove("dragging");
        if (!busy) {
          const files = Array.from(e.dataTransfer.files);
          onFiles(multiple ? files : files.slice(0, 1));
        }
      }}
    >
      <span className="drop-icon">
        <Icon name="image" size={32} />
      </span>
      <h2>
        {multiple
          ? "Add images to this identity"
          : compact
            ? "Check another image"
            : "Check before you share"}
      </h2>
      <p>
        Drop {multiple ? "images" : "an image"} here, or choose{" "}
        {multiple ? "files" : "a file"} from your device.
      </p>
      <button
        className="filled"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        <Icon name="upload" />
        {busy ? "Processing…" : label}
      </button>
      <input
        ref={input}
        aria-label={label}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={multiple}
        hidden
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <span className="caption">JPEG, PNG or WebP · Up to 16 MB / 24 MP</span>
    </div>
  );
}
