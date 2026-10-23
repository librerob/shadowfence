import { chromium } from "playwright";
import { cp, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";
import sharp from "sharp";
import "./fetch-fixtures.mjs";
await import("../scripts/store-art.mjs");

const extension = resolve("dist");
const dir = resolve("test-results/store");
const profile = await mkdtemp(join(tmpdir(), "shadowfence-store-capture-"));
const secret = "synthetic store capture passphrase";
const network = [],
  errors = [],
  images = [];
const executable = process.env.SHADOWFENCE_CHROME_EXECUTABLE;
const launch = async (folder, unpacked = extension) => {
  const context = await chromium.launchPersistentContext(folder, {
    ...(executable ? { executablePath: executable } : { channel: "chromium" }),
    headless: true,
    viewport: { width: 1280, height: 800 },
    colorScheme: "dark",
    args: [
      `--disable-extensions-except=${unpacked}`,
      `--load-extension=${unpacked}`,
    ],
  });
  await context.setOffline(true);
  context.on("request", (r) => {
    if (/^https?:/.test(r.url())) network.push(r.url());
  });
  context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
  return context;
};
const context = await launch(profile);
async function installedId(c) {
  const manager = await c.newPage();
  try {
    await manager.goto("chrome://extensions");
    const all = await manager.evaluate(
      () =>
        new Promise((resolve) =>
          chrome.developerPrivate.getExtensionsInfo(
            { includeDisabled: true },
            resolve,
          ),
        ),
    );
    const item = all.find(
      (x) => x.name === "ShadowFence" && x.state === "ENABLED",
    );
    assert.ok(item, "Extension is enabled");
    return item.id;
  } finally {
    await manager.close();
  }
}
const page = await context.newPage();
async function go(name) {
  await page.getByRole("link", { name, exact: true }).click();
  const route = {
    Overview: "overview",
    Identities: "identities",
    Settings: "settings",
    "Check image": "image",
    "Check text": "text",
  }[name];
  await page.locator(`main.page-${route}`).waitFor();
}
async function identity(name, description, color) {
  const create = page.getByRole("button", {
    name: "Create identity",
    exact: true,
  });
  if (await create.count()) await create.click();
  else
    await page
      .getByRole("button", { name: "New identity", exact: true })
      .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill(name);
  await dialog.getByLabel("Description", { exact: false }).fill(description);
  await dialog.getByRole("button", { name: color, exact: true }).click();
  await dialog
    .getByRole("button", { name: "Create identity", exact: true })
    .click();
  await dialog.waitFor({ state: "hidden" });
}
async function shot(name, dark = true, scrollToTop = true) {
  if (scrollToTop) await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => document.fonts.ready);
  const scheme = await page.evaluate(
    () => getComputedStyle(document.documentElement).colorScheme,
  );
  assert.equal(scheme, dark ? "dark" : "light");
  const path = join(dir, name);
  await page.screenshot({ path, fullPage: false, animations: "disabled" });
  const metadata = await sharp(path).metadata();
  assert.equal(metadata.width, 1280);
  assert.equal(metadata.height, 800);
  images.push({
    file: name,
    width: metadata.width,
    height: metadata.height,
    colorScheme: scheme,
  });
}
try {
  const id = await installedId(context);
  await page.goto(`chrome-extension://${id}/app.html`);
  await page.getByLabel("Passphrase", { exact: true }).fill(secret);
  await page.getByLabel("Confirm passphrase", { exact: true }).fill(secret);
  await page
    .getByRole("button", { name: "Create encrypted vault", exact: true })
    .click();
  await page.getByRole("navigation", { name: "Main navigation" }).waitFor();
  await go("Settings");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await go("Overview");
  await identity("Personal", "Demo: family and friends", "blue");
  await go("Identities");
  await page.getByLabel("Image label", { exact: false }).fill("Coffee photo");
  const photograph = await readFile("tests/fixtures/coffee.png");
  await page.locator("input[type=file]").setInputFiles({
    name: "coffee-photo.png",
    mimeType: "image/png",
    buffer: photograph,
  });
  await page.getByText("1 image registered.", { exact: true }).waitFor();
  await page.getByLabel("Identifier", { exact: true }).fill("alex@example.com");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByText("alex@example.com", { exact: true }).waitFor();
  await page.getByLabel("Identifier", { exact: true }).fill("@alex_example");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByText("@alex_example", { exact: true }).waitFor();
  await identity("Anonymous", "Demo: public writing and discussions", "violet");
  await page
    .getByRole("combobox", { name: "Current identity" })
    .selectOption({ label: "Anonymous" });
  await go("Check image");
  await page.locator("input[type=file]").setInputFiles({
    name: "coffee-photo.png",
    mimeType: "image/png",
    buffer: photograph,
  });
  await page
    .getByRole("heading", { name: "Identity collision detected", exact: true })
    .waitFor();
  const warning = await page
    .getByRole("heading", { name: "Identity collision detected", exact: true })
    .boundingBox();
  assert.ok(
    warning && warning.y + warning.height < 800,
    "Lead screenshot warning is visible",
  );
  await shot("01-image-check-dark.png");
  await go("Check text");
  await page
    .getByLabel("Text to check")
    .fill(
      "Draft public bio\n\nI write about everyday life and the things I am learning.\n\nContact: alex@example.com",
    );
  await page.getByRole("button", { name: "Check text", exact: true }).click();
  await page
    .getByRole("heading", {
      name: "Cross-identity identifiers detected",
      exact: true,
    })
    .waitFor();
  const textMatch = await page
    .locator(".text-results .match-row")
    .boundingBox();
  assert.ok(
    textMatch && textMatch.y + textMatch.height <= 784,
    "Text warning and match fit in the screenshot",
  );
  await shot("02-text-check-dark.png");
  await go("Identities");
  await shot("03-identities-dark.png");
  await go("Settings");
  await page
    .getByRole("heading", { name: "Vault security", exact: true })
    .evaluate((heading) =>
      window.scrollTo(
        0,
        window.scrollY + heading.getBoundingClientRect().top - 110,
      ),
    );
  await shot("04-vault-security-dark.png", true, false);
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const backup = JSON.parse(
    await readFile(await (await downloading).path(), "utf8"),
  );
  assert.equal(backup.version, 2);
  assert.ok(!JSON.stringify(backup).includes("alex@example.com"));
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await go("Overview");
  await shot("05-overview-light.png", false);
  // Exercise backup restoration between different unpacked origins, mirroring
  // the storage boundary encountered when moving to a different Store ID.
  const moved = await mkdtemp(join(tmpdir(), "shadowfence-different-id-"));
  await cp(extension, moved, { recursive: true });
  const freshProfile = await mkdtemp(
    join(tmpdir(), "shadowfence-new-install-"),
  );
  const fresh = await launch(freshProfile, moved);
  let changedId = false;
  try {
    const otherId = await installedId(fresh);
    assert.notEqual(otherId, id);
    changedId = true;
    const target = await fresh.newPage();
    await target.goto(`chrome-extension://${otherId}/app.html`);
    await target
      .getByRole("heading", { name: "Your private workspace", exact: true })
      .waitFor();
    await target.locator("input[type=file]").setInputFiles({
      name: "encrypted-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    await target.getByLabel("Passphrase", { exact: true }).fill(secret);
    await target
      .getByRole("button", { name: "Restore vault", exact: true })
      .click();
    await target.getByRole("navigation", { name: "Main navigation" }).waitFor();
    await target.getByRole("link", { name: "Identities", exact: true }).click();
    await target.getByText("alex@example.com", { exact: true }).waitFor();
    await target.getByText("Coffee photo", { exact: true }).waitFor();
  } finally {
    await fresh.close();
  }
  await page.getByRole("button", { name: "Lock vault", exact: true }).click();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.getByLabel("Passphrase", { exact: true }).fill(secret);
  const start = performance.now();
  await page.getByRole("button", { name: "Unlock vault", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .waitFor({ timeout: 60000 });
  const throttledPageUnlockMs = performance.now() - start;
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await cdp.detach();
  assert.deepEqual(network, []);
  assert.deepEqual(errors, []);
  const report = {
    status: "passed",
    browser: context.browser()?.version(),
    channel: executable ? "Stable Chrome for Testing" : "Playwright Chromium",
    screenshots: images,
    backupRestoreAcrossDifferentDevelopmentIds: changedId,
    throttledPageUnlockMs,
    cpuThrottling:
      "4x page CPU; not a measurement of real low-end hardware or guaranteed worker throttling",
    runtimeHttpRequests: network,
    runtimeErrors: errors,
    demonstration:
      "Fictional identities and example.com address. Coffee photo: Rachel Michetti, scikit-image sample, CC0.",
  };
  await mkdir("test-results", { recursive: true });
  await writeFile(
    "test-results/store-assets-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await context.close();
}
