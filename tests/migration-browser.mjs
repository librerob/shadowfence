import { chromium } from "playwright";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";

const extension = resolve("dist");
const legacy = JSON.parse(
  await readFile("tests/fixtures/vault-v1.json", "utf8"),
);
const secret = "legacy test passphrase only";
const profile = await mkdtemp(join(tmpdir(), "shadowfence-migration-"));
const errors = [],
  network = [],
  timings = [];
const report = {};
const launch = async (dir = profile) => {
  const c = await chromium.launchPersistentContext(dir, {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  await c.setOffline(true);
  c.on("request", (r) => {
    if (/^https?:/.test(r.url())) network.push(r.url());
  });
  return c;
};
let context = await launch();
let page;
async function stored(target = page) {
  return target.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("shadowfence", 1);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("vault", "readonly");
          const get = tx.objectStore("vault").get("primary");
          tx.oncomplete = () => {
            db.close();
            resolve(get.result ?? null);
          };
          tx.onerror = () => {
            db.close();
            reject(Error("read failed"));
          };
        };
        request.onerror = () => reject(Error("open failed"));
      }),
  );
}
async function submit(target = page, pass = secret) {
  await target.getByLabel("Passphrase", { exact: true }).fill(pass);
  const start = performance.now();
  await target
    .getByRole("button", { name: "Unlock vault", exact: true })
    .click();
  return start;
}
try {
  const manager = await context.newPage();
  await manager.goto("chrome://extensions");
  const installed = await manager.evaluate(
    () =>
      new Promise((resolve) =>
        chrome.developerPrivate.getExtensionsInfo(
          { includeDisabled: true },
          resolve,
        ),
      ),
  );
  const id = installed.find((x) => x.name === "ShadowFence")?.id;
  assert.ok(id);
  await manager.close();
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`chrome-extension://${id}/app.html`);
  await page
    .getByRole("heading", { name: "Your private workspace", exact: true })
    .waitFor();
  // Seed a fixed synthetic v1 record; no migration or fixture regeneration here.
  await page.evaluate(
    (envelope) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("shadowfence", 1);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("vault", "readwrite");
          tx.objectStore("vault").put(envelope, "primary");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(Error("seed failed"));
          };
        };
      }),
    legacy,
  );
  await page.reload();
  let workers = 0;
  page.on("worker", (w) => {
    if (w.url().includes("key-worker-")) workers++;
  });
  await submit(page, "wrong legacy passphrase");
  await page.getByText(/Could not unlock/).waitFor();
  assert.deepEqual(await stored(), legacy);
  assert.equal(workers, 0, "Wrong legacy passphrase cannot start Argon2");
  report.wrongPassphrasePreservesLegacy = true;
  // Abort the actual IndexedDB migration transaction to simulate a failed write.
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      const request = put.call(this, value, key);
      if (value?.format === "shadowfence" && value.version === 2)
        this.transaction.abort();
      return request;
    };
  });
  await submit();
  await page.getByText(/Your changes could not be saved/).waitFor();
  assert.deepEqual(await stored(), legacy);
  assert.equal(
    page.workers().length,
    0,
    "KDF worker is disposable after failure",
  );
  report.failedCommitPreservesLegacy = true;
  await page.reload();
  const start = await submit();
  await page.getByRole("navigation", { name: "Main navigation" }).waitFor();
  timings.push({
    operation: "legacyUnlockAndUpgrade",
    ms: performance.now() - start,
  });
  const upgraded = await stored();
  assert.equal(upgraded.version, 2);
  assert.deepEqual(upgraded.kdf, {
    name: "argon2id",
    version: 19,
    memoryKiB: 65536,
    iterations: 3,
    parallelism: 1,
  });
  assert.notEqual(upgraded.salt, legacy.salt);
  assert.equal(page.workers().length, 0);
  await page.getByRole("link", { name: "Identities", exact: true }).click();
  await page.getByText("legacy@example.com", { exact: true }).waitFor();
  await page.getByText("Legacy photo", { exact: true }).waitFor();
  report.legacyUpgradePreservesRecords = true;
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const backup = JSON.parse(
    await readFile(await (await downloading).path(), "utf8"),
  );
  assert.deepEqual(backup, upgraded);
  report.version2Backup = true;
  // Lock while a real password-change worker is running. It must terminate and
  // must not write the proposed passphrase or revive the unlocked workspace.
  await page
    .getByLabel("New passphrase", { exact: true })
    .fill("cancelled new passphrase only");
  await page
    .getByLabel("Confirm new passphrase", { exact: true })
    .fill("cancelled new passphrase only");
  const workerStarted = page.waitForEvent("worker");
  await page
    .getByRole("button", { name: "Update passphrase", exact: true })
    .click();
  const worker = await workerStarted;
  const workerStopped = new Promise((resolve) => worker.once("close", resolve));
  await page.getByRole("button", { name: "Lock vault", exact: true }).click();
  await workerStopped;
  await page
    .getByRole("heading", { name: "Welcome back", exact: true })
    .waitFor();
  assert.deepEqual(await stored(), upgraded);
  assert.equal(page.workers().length, 0);
  report.lockCancelsKdfWithoutWriting = true;
  // Exercise the bundled worker directly with an independently checked key.
  const workerFile = (await readdir("dist/assets")).find(
    (n) => n.startsWith("key-worker-") && n.endsWith(".js"),
  );
  const vector = await page.evaluate(async (url) => {
    const worker = new Worker(url, { type: "module" });
    let ticks = 0;
    const heartbeat = setInterval(() => ticks++, 10);
    const start = performance.now();
    try {
      const key = await new Promise((resolve, reject) => {
        worker.onmessage = (e) =>
          e.data.key ? resolve(e.data.key) : reject(Error(e.data.error));
        worker.onerror = (e) => reject(Error(e.message));
        worker.postMessage({
          password: new TextEncoder().encode("synthetic benchmark passphrase"),
          salt: new Uint8Array(16).fill(7),
          profile: {
            name: "argon2id",
            version: 19,
            memoryKiB: 65536,
            iterations: 3,
            parallelism: 1,
          },
        });
      });
      let exportRejected = false;
      try {
        await crypto.subtle.exportKey("raw", key);
      } catch {
        exportRejected = true;
      }
      const reference = await crypto.subtle.importKey(
        "raw",
        Uint8Array.from(
          "6160c13cfd1e691e15a8315f9fcb3bdb632811606e6b53aa7c56e5a0aa634da5".match(
            /../g,
          ),
          (x) => parseInt(x, 16),
        ),
        "AES-GCM",
        false,
        ["encrypt"],
      );
      const algorithm = { name: "AES-GCM", iv: new Uint8Array(12).fill(1) },
        text = new TextEncoder().encode("browser vector");
      const hex = (b) =>
        Array.from(new Uint8Array(b), (n) =>
          n.toString(16).padStart(2, "0"),
        ).join("");
      return {
        nonExtractable: !key.extractable,
        exportRejected,
        equal:
          hex(await crypto.subtle.encrypt(algorithm, key, text)) ===
          hex(await crypto.subtle.encrypt(algorithm, reference, text)),
        ms: performance.now() - start,
        ticks,
      };
    } finally {
      clearInterval(heartbeat);
      worker.terminate();
    }
  }, `chrome-extension://${id}/assets/${workerFile}`);
  assert.ok(vector.nonExtractable && vector.exportRejected && vector.equal);
  assert.ok(
    vector.ticks >= 5,
    "Page event loop remains responsive while KDF runs",
  );
  report.productionWorker = vector;
  await context.close();
  context = await launch();
  page = await context.newPage();
  await page.goto(`chrome-extension://${id}/app.html`);
  const againStart = await submit();
  await page.getByRole("navigation", { name: "Main navigation" }).waitFor();
  timings.push({
    operation: "version2UnlockAfterRestart",
    ms: performance.now() - againStart,
  });
  assert.deepEqual(
    await stored(),
    upgraded,
    "Unlocking v2 does not rewrite it",
  );
  report.restartPersistence = true;
  const freshProfile = await mkdtemp(
    join(tmpdir(), "shadowfence-legacy-restore-"),
  );
  const fresh = await launch(freshProfile);
  try {
    const target = await fresh.newPage();
    await target.goto(`chrome-extension://${id}/app.html`);
    const hostile = {
      ...upgraded,
      kdf: { ...upgraded.kdf, memoryKiB: 2 ** 30 },
    };
    await target.locator("input[type=file]").setInputFiles({
      name: "hostile.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(hostile)),
    });
    await target.getByLabel("Passphrase", { exact: true }).fill(secret);
    await target
      .getByRole("button", { name: "Restore vault", exact: true })
      .click();
    await target.getByText(/unsupported key derivation/).waitFor();
    assert.equal(await stored(target), null);
    assert.equal(target.workers().length, 0);
    report.hostileImportRejectedBeforeKdf = true;
    await target.locator("input[type=file]").setInputFiles({
      name: "legacy.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(legacy)),
    });
    await target.getByLabel("Passphrase", { exact: true }).fill(secret);
    await target
      .getByRole("button", { name: "Restore vault", exact: true })
      .click();
    await target.getByRole("navigation", { name: "Main navigation" }).waitFor();
    assert.equal((await stored(target)).version, 2);
    await target.getByRole("link", { name: "Identities", exact: true }).click();
    await target.getByText("legacy@example.com", { exact: true }).waitFor();
    await target.getByText("Legacy photo", { exact: true }).waitFor();
    report.legacyRestoreUpgrades = true;
  } finally {
    await fresh.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(network, []);
  await mkdir("test-results", { recursive: true });
  Object.assign(report, {
    status: "passed",
    timings,
    runtimeErrors: errors,
    runtimeHttpRequests: network,
  });
  await writeFile(
    "test-results/migration-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await context.close();
}
