import { validateEnvelope, type Envelope } from "./crypto";

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("shadowfence", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("vault");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("Local storage could not be opened."));
    request.onblocked = () =>
      reject(new Error("Close other ShadowFence tabs and try again."));
  });
}
export async function readEnvelope(): Promise<Envelope | null> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("vault", "readonly");
    const req = tx.objectStore("vault").get("primary");
    tx.oncomplete = () => {
      db.close();
      try {
        resolve(req.result ? validateEnvelope(req.result) : null);
      } catch (e) {
        reject(e);
      }
    };
    tx.onerror = () => {
      db.close();
      reject(new Error("Could not read the encrypted vault."));
    };
  });
}
// Compare and replace inside one transaction; stale tabs cannot overwrite newer edits.
export async function writeEnvelope(
  envelope: Envelope | null,
  expectedRevision: string | null,
): Promise<void> {
  if (envelope) validateEnvelope(envelope);
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("vault", "readwrite");
    const store = tx.objectStore("vault");
    const req = store.get("primary");
    let conflict = false;
    req.onsuccess = () => {
      if ((req.result?.revision ?? null) !== expectedRevision) {
        conflict = true;
        tx.abort();
        return;
      }
      if (envelope) store.put(envelope, "primary");
      else store.delete("primary");
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(
        new Error(
          conflict
            ? "The vault changed in another tab. Lock and unlock to load the latest version."
            : "Your changes could not be saved. Local storage may be full.",
        ),
      );
    };
  });
}
