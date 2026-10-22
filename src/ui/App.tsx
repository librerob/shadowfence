import { useEffect, useState } from "react";
import { useVault } from "./useVault";
import { Unlock } from "./Unlock";
import { Brand, Icon, type IconName } from "./Icon";
import { Empty, IdentitySelect, Notice } from "./components";
import { Identities, IdentityForm } from "./Identities";
import { CheckImage } from "./CheckImage";
import { CheckText } from "./CheckText";
import { Settings, applyAppearance, readAppearance } from "./Settings";

const navigation: { id: string; label: string; icon: IconName }[] = [
  { id: "overview", label: "Overview", icon: "home" },
  { id: "identities", label: "Identities", icon: "identities" },
  { id: "image", label: "Check image", icon: "image" },
  { id: "text", label: "Check text", icon: "text" },
  { id: "settings", label: "Settings", icon: "settings" },
  { id: "about", label: "About", icon: "info" },
];
const route = () => {
  const id = location.hash.slice(1);
  return id === "main"
    ? "overview"
    : navigation.some((i) => i.id === id)
      ? id
      : "overview";
};
export function App() {
  const vault = useVault(),
    [page, setPage] = useState(route),
    [creating, setCreating] = useState(false);
  useEffect(() => {
    const change = () => setPage(route());
    window.addEventListener("hashchange", change);
    const storage = () => applyAppearance(readAppearance());
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("hashchange", change);
      window.removeEventListener("storage", storage);
    };
  }, []);
  useEffect(() => {
    if (vault.status !== "open") setCreating(false);
  }, [vault.status]);
  useEffect(() => {
    document.title = `${navigation.find((i) => i.id === page)?.label ?? "ShadowFence"} · ShadowFence`;
    window.scrollTo(0, 0);
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [page]);
  if (vault.status !== "open") return <Unlock vault={vault} />;
  const selected = vault.data.identities.find(
    (i) => i.id === vault.data.currentId,
  );
  const goto = (id: string) => {
    location.hash = id;
  };
  const create = () => setCreating(true);
  const selectIdentity = async (id: string) => {
    try {
      await vault.update((data) => ({ ...data, currentId: id }));
    } catch (e) {
      vault.setError((e as Error).message);
    }
  };
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Brand />
        </div>
        <nav aria-label="Main navigation">
          {navigation.map((i) => (
            <a
              key={i.id}
              href={`#${i.id}`}
              aria-current={page === i.id ? "page" : undefined}
            >
              <Icon name={i.icon} />
              <span>{i.label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="vault-state">
            <Icon name="lock" size={16} />
            <span>Encrypted local vault</span>
          </div>
          <button className="text-button" onClick={() => vault.lock()}>
            <Icon name="lock" size={18} />
            Lock vault
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="breadcrumb">Your private workspace</span>
          {selected && (
            <IdentitySelect
              identities={vault.data.identities}
              value={selected.id}
              disabled={vault.busy}
              onChange={(id) => void selectIdentity(id)}
            />
          )}
        </header>
        <main id="main" tabIndex={-1} className={`main-content page-${page}`}>
          {vault.error && <Notice tone="error">{vault.error}</Notice>}
          {page === "overview" && (
            <>
              <div className="page-title">
                <div>
                  <span className="eyebrow">A moment before you share</span>
                  <h1>Keep your identities separate.</h1>
                  <p>
                    Check what you share against what belongs to your other
                    identities.
                  </p>
                </div>
              </div>
              {!selected ? (
                <Empty
                  title="Start with your first identity"
                  action={
                    <button className="filled" onClick={create}>
                      <Icon name="plus" />
                      Create identity
                    </button>
                  }
                >
                  Give it a name like Personal or Anonymous. Add images and
                  identifiers you have already used with it.
                </Empty>
              ) : (
                <>
                  <div className="quick-checks">
                    <button
                      className="check-action"
                      onClick={() => goto("image")}
                    >
                      <span className="tonal-icon">
                        <Icon name="image" size={26} />
                      </span>
                      <h2>Check an image</h2>
                      <p>Find photographs that could link your identities.</p>
                      <span className="action-end">
                        Choose an image
                        <Icon name="arrow" />
                      </span>
                    </button>
                    <button
                      className="check-action"
                      onClick={() => goto("text")}
                    >
                      <span className="tonal-icon">
                        <Icon name="text" size={26} />
                      </span>
                      <h2>Check text</h2>
                      <p>
                        Spot an email, handle or other registered identifier.
                      </p>
                      <span className="action-end">
                        Review your text
                        <Icon name="arrow" />
                      </span>
                    </button>
                  </div>
                  <section className="overview-identities">
                    <div className="section-heading">
                      <h2>Your identities</h2>
                      <button
                        className="text-button"
                        onClick={() => goto("identities")}
                      >
                        Manage identities
                        <Icon name="arrow" size={18} />
                      </button>
                    </div>
                    {vault.data.identities.map((i) => (
                      <button
                        className="overview-row"
                        key={i.id}
                        onClick={() => goto("identities")}
                      >
                        <span className={`avatar ${i.color}`}>
                          {i.name[0].toUpperCase()}
                        </span>
                        <div>
                          <strong>{i.name}</strong>
                          <span>{i.description || "No description"}</span>
                        </div>
                        <span>
                          {i.images.length}{" "}
                          {i.images.length === 1 ? "image" : "images"} ·{" "}
                          {i.identifiers.length}{" "}
                          {i.identifiers.length === 1
                            ? "identifier"
                            : "identifiers"}
                        </span>
                        <Icon name="arrow" size={18} />
                      </button>
                    ))}
                  </section>
                </>
              )}
              <div className="quiet-note">
                <Icon name="info" />
                <p>
                  Check files before selecting them on a website. ShadowFence
                  compares your registered references locally; it does not block
                  uploads or guarantee anonymity.
                </p>
              </div>
            </>
          )}
          {page === "identities" && (
            <Identities vault={vault} onCreate={create} />
          )}
          {(page === "image" || page === "text") &&
            (!selected ? (
              <Empty
                title="Create an identity first"
                action={
                  <button className="filled" onClick={create}>
                    Create identity
                  </button>
                }
              >
                Choose who you intend to share as, then check for material
                registered under other identities.
              </Empty>
            ) : page === "image" ? (
              <CheckImage vault={vault} />
            ) : (
              <CheckText key={selected.id} vault={vault} />
            ))}
          {page === "settings" && <Settings vault={vault} />}
          {page === "about" && (
            <>
              <div className="page-title">
                <div>
                  <span className="eyebrow">ShadowFence 0.1.0</span>
                  <h1>A boundary, before you share.</h1>
                  <p>
                    Local checks for accidental links between online identities.
                  </p>
                </div>
              </div>
              <section className="reading">
                <h2>How image checks work</h2>
                <p>
                  Files are compared using SHA-256 for exact duplicates and
                  paired perceptual fingerprints for visual similarity. A
                  changed filename does not avoid an exact match. Resizing and
                  JPEG recompression are the initial perceptual matching goals.
                </p>
                <h2>What a check can miss</h2>
                <p>
                  Only images and identifiers you register are known to this
                  vault. Cropping, rotation, screenshots, heavy editing and very
                  low-detail images are not reliably covered. A similarity
                  warning is a prompt to review, not proof of an identity
                  connection.
                </p>
                <p>
                  There is no face recognition, internet image search, IP
                  protection, cookie isolation or automatic upload blocking.
                </p>
                <h2>Your local vault</h2>
                <p>
                  Identity records, identifiers, image labels and fingerprints
                  are encrypted with AES-256-GCM. A key is derived from your
                  passphrase with PBKDF2-SHA-256 (600,000 iterations). Originals
                  and checked text are never stored. Appearance settings are
                  unencrypted.
                </p>
                <p>
                  Encryption protects a locked vault against casual data theft.
                  It cannot protect an unlocked session, a compromised browser
                  or device, or a weak passphrase. Perceptual fingerprints can
                  reveal similarity if stolen in decrypted form.
                </p>
                <h2>Open source</h2>
                <p>
                  GPL-3.0-or-later.{" "}
                  <a
                    href="https://github.com/librerob/shadowfence"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Source code and documentation
                    <Icon name="arrow" size={16} />
                  </a>
                </p>
              </section>
            </>
          )}
        </main>
        <footer className="app-footer">
          ShadowFence <span>Local checks. Clear boundaries.</span>
        </footer>
      </div>
      {creating && (
        <IdentityForm vault={vault} onClose={() => setCreating(false)} />
      )}
    </div>
  );
}
