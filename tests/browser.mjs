import { chromium } from "playwright";
import { mkdtemp, mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import "./fetch-fixtures.mjs";
await import("./generate-images.mjs");

const extension = resolve("dist");
const profile = await mkdtemp(join(tmpdir(), "shadowfence-test-"));
const screenshots = resolve("test-results/screenshots");
await mkdir(screenshots, { recursive: true });
const errors = [],
  network = [];
const launch = async () => {
  const c = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    viewport: { width: 1280, height: 900 },
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  await c.setOffline(true);
  return c;
};
let context = await launch();
let page;
const passphrase = "test vault passphrase only";
const savedPassphrase = "updated test passphrase only";
async function screenshot(name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: join(screenshots, name + ".png"),
    fullPage: true,
    animations: "disabled",
  });
}
async function visible(text) {
  await page.getByText(text, { exact: true }).waitFor({ timeout: 15000 });
}
async function privateFields(target = page) {
  const fields = await target
    .locator('textarea, input:not([type="file"])')
    .evaluateAll((elements) =>
      elements.map((el) => ({
        spellcheck: el.spellcheck,
        autocomplete: el.autocomplete,
        autocorrect: el.getAttribute("autocorrect"),
        autocapitalize: el.getAttribute("autocapitalize"),
        password: el.type === "password",
      })),
    );
  assert.ok(fields.length);
  for (const field of fields) {
    assert.equal(field.spellcheck, false);
    assert.equal(field.autocorrect, "off");
    assert.equal(field.autocapitalize, "off");
    if (field.password)
      assert.match(field.autocomplete, /^(new|current)-password$/);
    else assert.equal(field.autocomplete, "off");
  }
}
async function unlock(secret = passphrase) {
  await page.getByLabel("Passphrase", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Unlock vault", exact: true }).click();
  await page.getByRole("navigation", { name: "Main navigation" }).waitFor();
}
async function go(name) {
  await page.getByRole("link", { name, exact: true }).click();
  const route = {
    Overview: "overview",
    Identities: "identities",
    "Check image": "image",
    "Check text": "text",
    Settings: "settings",
    About: "about",
  }[name];
  await page.locator(`main.page-${route}`).waitFor();
}
async function createIdentity(name, color = "violet") {
  const button = page.getByRole("button", {
    name: "Create identity",
    exact: true,
  });
  if (await button.count()) await button.click();
  else
    await page
      .getByRole("button", { name: "New identity", exact: true })
      .click();
  await page.getByRole("dialog").getByLabel("Name", { exact: true }).fill(name);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: color, exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create identity", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
}
let id;
const results = {};
try {
  const manager = await context.newPage();
  await manager.goto("chrome://extensions");
  const extensions = await manager.evaluate(
    () =>
      new Promise((resolve) =>
        chrome.developerPrivate.getExtensionsInfo(
          { includeDisabled: true },
          resolve,
        ),
      ),
  );
  const installed = extensions.find((x) => x.name === "ShadowFence");
  assert.ok(installed, "Production extension is installed");
  assert.equal(installed.state, "ENABLED");
  id = installed.id;
  results.browser = await context.browser()?.version();
  results.manifest = "enabled in Chromium";
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  context.on("request", (request) => {
    if (/^https?:/.test(request.url())) network.push(request.url());
  });
  await page.goto(`chrome-extension://${id}/app.html`);
  await page.getByLabel("Passphrase", { exact: true }).fill(passphrase);
  await page.getByLabel("Confirm passphrase", { exact: true }).fill(passphrase);
  await privateFields();
  await screenshot("welcome");
  await page.getByRole("button", { name: "Create encrypted vault" }).click();
  await page
    .getByRole("button", { name: "Create identity", exact: true })
    .waitFor();
  await screenshot("empty");
  await createIdentity("Personal", "blue");
  await go("Identities");
  await page
    .getByRole("button", { name: "Edit identity", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Description", { exact: false })
    .fill("Family, friends and everyday life");
  await screenshot("identity-dialog");
  await privateFields();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await privateFields();
  await page.getByLabel("Image label", { exact: false }).fill("Profile photo");
  await page
    .locator("input[type=file]")
    .setInputFiles("tests/fixtures/chelsea.png");
  await visible("1 image registered.");
  await page
    .locator("input[type=file]")
    .setInputFiles("tests/fixtures/chelsea.png");
  await visible("0 images registered. 1 already registered.");
  await page
    .getByLabel("Identifier", { exact: true })
    .fill("personal@example.com");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await visible("personal@example.com");
  await page.getByLabel("Identifier", { exact: true }).fill("@personal_handle");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await visible("@personal_handle");
  await page
    .getByRole("button", { name: "Edit @personal_handle", exact: true })
    .click();
  await page
    .getByLabel("Identifier", { exact: true })
    .fill("@my_personal_handle");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await visible("@my_personal_handle");
  await screenshot("identities");
  await go("Check image");
  await page
    .locator("input[type=file]")
    .setInputFiles("tests/fixtures/chelsea.png");
  await visible("No reference images to compare");
  assert.equal(await page.locator(".result .notice.success").count(), 0);
  await screenshot("no-image-references");
  await go("Check text");
  await page.getByLabel("Text to check").fill("personal@example.com");
  await page.getByRole("button", { name: "Check text", exact: true }).click();
  await visible("No reference identifiers to compare");
  assert.equal(await page.locator(".text-results .notice.success").count(), 0);
  await screenshot("no-identifier-references");
  results.emptyReferenceChecksNeutral = true;
  await go("Identities");
  await createIdentity("Anonymous");
  await page
    .getByRole("combobox", { name: "Current identity" })
    .selectOption({ label: "Anonymous" });
  await go("Check image");
  await screenshot("image-empty");
  await page
    .locator("input[type=file]")
    .setInputFiles("tests/fixtures/chelsea.png");
  await visible("Identity collision detected");
  await screenshot("exact-match");
  await page.locator("input[type=file]").setInputFiles({
    name: "renamed-photo.png",
    mimeType: "image/png",
    buffer: await readFile("tests/fixtures/chelsea.png"),
  });
  await visible("Identity collision detected");
  await page
    .getByRole("button", { name: "Register intentional reuse" })
    .click();
  await visible("Also registered here. Cross-identity reuse remains visible.");
  await page
    .locator("input[type=file]")
    .setInputFiles("test-results/images/2-recompressed.jpg");
  await visible("Possible identity collision");
  await screenshot("similar-match");
  await page
    .locator("input[type=file]")
    .setInputFiles("tests/fixtures/coffee.png");
  await visible("No cross-identity matches detected.");
  await screenshot("no-match");
  await page.locator("input[type=file]").setInputFiles({
    name: "broken.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("not an image"),
  });
  await page.getByRole("alert").waitFor();
  await screenshot("invalid-image");
  await page
    .getByRole("combobox", { name: "Current identity" })
    .selectOption({ label: "Personal" });
  await page
    .locator("input[type=file]")
    .setInputFiles("tests/fixtures/coffee.png");
  await visible("No cross-identity matches detected.");
  await page
    .getByRole("combobox", { name: "Current identity" })
    .selectOption({ label: "Anonymous" });
  await go("Check text");
  await page
    .getByLabel("Text to check")
    .fill("Please contact PERSONAL@example.com.");
  await page.getByRole("button", { name: "Check text", exact: true }).click();
  await visible("Cross-identity identifiers detected");
  await screenshot("text-match");
  await page.getByLabel("Text to check").fill("An unrelated example sentence.");
  await page.getByRole("button", { name: "Check text", exact: true }).click();
  await visible("No cross-identity identifiers detected.");
  assert.equal(await page.locator(".text-results .notice.success").count(), 1);
  await go("Overview");
  await screenshot("overview-light");
  await go("Settings");
  for (const theme of ["Light", "Dark", "AMOLED"]) {
    await page.getByRole("button", { name: theme, exact: true }).click();
    await screenshot("settings-" + theme.toLowerCase());
    await go("Overview");
    await screenshot("overview-" + theme.toLowerCase());
    await go("Settings");
    const themedPopup = await context.newPage();
    await themedPopup.setViewportSize({ width: 360, height: 540 });
    await themedPopup.goto(`chrome-extension://${id}/popup.html`);
    await themedPopup.screenshot({
      path: join(screenshots, "popup-" + theme.toLowerCase() + ".png"),
    });
    await themedPopup.close();
  }
  const black = await page.evaluate(
    () => getComputedStyle(document.documentElement).backgroundColor,
  );
  assert.equal(black, "rgb(0, 0, 0)");
  let minContrast = Infinity,
    contrastChecks = 0;
  for (const theme of ["Light", "Dark", "AMOLED"]) {
    await page.getByRole("button", { name: theme, exact: true }).click();
    for (const accent of [
      "Violet",
      "Blue",
      "Teal",
      "Green",
      "Rose",
      "Neutral",
    ]) {
      await page.getByRole("button", { name: accent, exact: true }).click();
      const ratios = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        const luminance = (name) => {
          let value = style.getPropertyValue(name).trim().slice(1);
          if (value.length === 3)
            value = value
              .split("")
              .map((x) => x + x)
              .join("");
          const rgb = [0, 2, 4]
            .map((i) => parseInt(value.slice(i, i + 2), 16) / 255)
            .map((v) =>
              v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
            );
          return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
        };
        return [
          ["--on-surface", "--background"],
          ["--on-surface-variant", "--surface"],
          ["--on-primary", "--primary"],
          ["--on-primary-container", "--primary-container"],
          ["--error", "--error-container"],
          ["--success", "--success-container"],
          ["--warning", "--warning-container"],
        ].map(([fg, bg]) => {
          const a = luminance(fg),
            b = luminance(bg);
          return {
            fg,
            bg,
            ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
          };
        });
      });
      for (const pair of ratios) {
        assert.ok(
          pair.ratio >= 4.5,
          `${theme}/${accent} ${pair.fg} on ${pair.bg}: ${pair.ratio}`,
        );
        minContrast = Math.min(minContrast, pair.ratio);
        contrastChecks++;
      }
    }
  }
  results.contrast = { checks: contrastChecks, minRatio: minContrast };
  await page.getByRole("button", { name: "Teal", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup" }).click();
  const download = await downloadPromise;
  const backup = JSON.parse(await readFile(await download.path(), "utf8"));
  assert.equal(backup.format, "shadowfence");
  assert.ok(!JSON.stringify(backup).includes("Personal"));
  results.encryptedBackup = true;
  await page
    .getByLabel("New passphrase", { exact: true })
    .fill(savedPassphrase);
  await page
    .getByLabel("Confirm new passphrase", { exact: true })
    .fill(savedPassphrase);
  await page.getByRole("button", { name: "Update passphrase" }).click();
  await visible(
    "Passphrase changed. Existing backups still use their old passphrase.",
  );
  await page.reload();
  await visible("Welcome back");
  await page
    .getByLabel("Passphrase", { exact: true })
    .fill("wrong passphrase here");
  await page.getByRole("button", { name: "Unlock vault", exact: true }).click();
  await page.getByRole("alert").waitFor();
  await screenshot("invalid-passphrase");
  await unlock(savedPassphrase);
  await go("Overview");
  for (const width of [760, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await screenshot("narrow-" + width);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `No horizontal overflow at ${width}`,
    );
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await go("Settings");
  await page.getByRole("button", { name: "System", exact: true }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  assert.equal(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).colorScheme,
    ),
    "dark",
  );
  await page.emulateMedia({ colorScheme: "light" });
  assert.equal(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).colorScheme,
    ),
    "light",
  );
  // The actual popup document opens extension tabs without the tabs permission.
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 360, height: 540 });
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await popup.screenshot({ path: join(screenshots, "popup-light.png") });
  const newTab = context.waitForEvent("page");
  await popup.getByRole("button", { name: "Check image", exact: true }).click();
  const target = await newTab;
  await target.waitForURL(`chrome-extension://${id}/app.html#image`);
  await target.close();
  await popup.close();
  results.popup = true;
  // Run the production image worker against the complete reproducible corpus.
  const worker = (await readdir("dist/assets")).find((x) =>
    /^worker-.*\.js$/.test(x),
  );
  const cases = JSON.parse(
    await readFile("test-results/image-cases.json", "utf8"),
  );
  cases.push({
    name: "collins-flight.jpg",
    paths: { original: "tests/fixtures/collins-flight.jpg" },
  });
  const hashes = [],
    timings = [];
  for (const item of cases) {
    const fingerprints = {};
    for (const [variant, path] of Object.entries(item.paths)) {
      const bytes = await readFile(path);
      const result = await page.evaluate(
        async ({ worker, base64 }) => {
          const start = performance.now();
          const w = new Worker(chrome.runtime.getURL("assets/" + worker), {
            type: "module",
          });
          try {
            return await new Promise((resolve, reject) => {
              const timer = setTimeout(() => {
                w.terminate();
                reject(Error("timeout"));
              }, 15000);
              w.onmessage = (e) => {
                clearTimeout(timer);
                resolve({ ...e.data, elapsed: performance.now() - start });
              };
              w.onerror = (e) => reject(Error(e.message));
              w.postMessage(
                new Blob([
                  Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
                ]),
              );
            });
          } finally {
            w.terminate();
          }
        },
        { worker, base64: bytes.toString("base64") },
      );
      assert.ok(result.result, JSON.stringify(result));
      fingerprints[variant] = result.result;
      timings.push(result.elapsed);
    }
    hashes.push({ name: item.name, fingerprints });
  }
  const distance = (a, b) => {
    let x = BigInt("0x" + a) ^ BigInt("0x" + b),
      n = 0;
    while (x) {
      x &= x - 1n;
      n++;
    }
    return n;
  };
  const same = (a, b) =>
    a.sha256 === b.sha256 ||
    (a.detail >= 8 &&
      b.detail >= 8 &&
      distance(a.phash, b.phash) <= 8 &&
      distance(a.dhash, b.dhash) <= 10);
  const summary = {};
  for (const variant of Object.keys(hashes[0].fingerprints).filter(
    (x) => x !== "original",
  ))
    summary[variant] = {
      detected: hashes.filter(
        (x) =>
          x.fingerprints[variant] &&
          same(x.fingerprints.original, x.fingerprints[variant]),
      ).length,
      total: hashes.filter((x) => x.fingerprints[variant]).length,
    };
  let unrelated = 0,
    falsePositives = 0;
  for (let a = 0; a < hashes.length; a++)
    for (let b = a + 1; b < hashes.length; b++) {
      unrelated++;
      if (
        same(hashes[a].fingerprints.original, hashes[b].fingerprints.original)
      )
        falsePositives++;
    }
  const imageReport = {
    thresholds: { pHash: 8, dHash: 10, minDetail: 8 },
    summary,
    unrelated: { falsePositives, total: unrelated },
    samePersonDifferentPhoto: {
      matched: same(
        hashes[0].fingerprints.original,
        hashes.at(-1).fingerprints.original,
      ),
      subject: "Eileen Collins; NASA portrait vs STS-93 flight photo",
      pairs: 1,
    },
    timingMs: {
      min: Math.min(...timings),
      max: Math.max(...timings),
      mean: timings.reduce((a, b) => a + b) / timings.length,
    },
    hashes,
  };
  await writeFile(
    "test-results/image-evaluation.json",
    JSON.stringify(imageReport, null, 2),
  );
  assert.equal(summary.resized.detected, 6, "All resize fixtures detected");
  assert.equal(
    summary.recompressed.detected,
    6,
    "All recompression fixtures detected",
  );
  assert.equal(falsePositives, 0, "Unrelated original pairs are not matched");
  assert.equal(
    imageReport.samePersonDifferentPhoto.matched,
    false,
    "Different photographs of the same person do not match",
  );
  results.imageEvaluation = imageReport.summary;
  // Explicit locking propagates to other extension tabs.
  const second = await context.newPage();
  await second.goto(`chrome-extension://${id}/app.html`);
  await second.getByLabel("Passphrase", { exact: true }).fill(savedPassphrase);
  await second
    .getByRole("button", { name: "Unlock vault", exact: true })
    .click();
  await second.getByRole("navigation", { name: "Main navigation" }).waitFor();
  await page.getByRole("button", { name: "Lock vault", exact: true }).click();
  await second.getByRole("heading", { name: "Welcome back" }).waitFor();
  await second.close();
  results.globalLock = true;
  await context.close();
  context = await launch();
  page = await context.newPage();
  await page.goto(`chrome-extension://${id}/app.html`);
  await visible("Welcome back");
  await unlock(savedPassphrase);
  await go("Identities");
  await visible("@my_personal_handle");
  results.browserRestartPersistence = true;
  await page.getByRole("button", { name: /Anonymous.*image/ }).click();
  await page
    .getByRole("button", { name: "Remove image 1", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Registered images 0", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Delete identity", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete identity", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(
    await page.getByRole("option", { name: "Anonymous", exact: true }).count(),
    0,
  );
  results.removeAndDelete = true;
  // Restore into a separate fresh profile using the pre-change encrypted backup.
  const restoreProfile = await mkdtemp(join(tmpdir(), "shadowfence-restore-"));
  const restoreContext = await chromium.launchPersistentContext(
    restoreProfile,
    {
      channel: "chromium",
      headless: true,
      args: [
        `--disable-extensions-except=${extension}`,
        `--load-extension=${extension}`,
      ],
    },
  );
  try {
    const restorePage = await restoreContext.newPage();
    await restorePage.clock.install();
    await restorePage.goto(`chrome-extension://${id}/app.html`);
    await restorePage.locator("input[type=file]").setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    await restorePage
      .getByLabel("Passphrase", { exact: true })
      .fill(passphrase);
    await restorePage
      .getByRole("button", { name: "Restore vault", exact: true })
      .click();
    await restorePage
      .getByRole("navigation", { name: "Main navigation" })
      .waitFor();
    results.restore = true;
    await restorePage.clock.fastForward(301000);
    await restorePage
      .getByRole("heading", { name: "Welcome back", exact: true })
      .waitFor();
    results.idleLock = true;
    // Changing system time does not fire timers: the first trusted input must
    // expire the session before it can refresh activity or reach a text field.
    await restorePage
      .getByLabel("Passphrase", { exact: true })
      .fill(passphrase);
    await restorePage
      .getByRole("button", { name: "Unlock vault", exact: true })
      .click();
    await restorePage
      .getByRole("navigation", { name: "Main navigation" })
      .waitFor();
    await restorePage
      .getByRole("link", { name: "Check text", exact: true })
      .click();
    await privateFields(restorePage);
    await restorePage.getByLabel("Text to check", { exact: true }).focus();
    await restorePage.clock.setSystemTime(
      new Date((await restorePage.evaluate(() => Date.now())) + 301000),
    );
    await restorePage.keyboard.type("sensitive");
    await restorePage
      .getByRole("heading", { name: "Welcome back", exact: true })
      .waitFor();
    results.expiredInputBlockedWithoutTimer = true;
    await restorePage
      .getByLabel("Passphrase", { exact: true })
      .fill(passphrase);
    await restorePage
      .getByRole("button", { name: "Unlock vault", exact: true })
      .click();
    await restorePage
      .getByRole("navigation", { name: "Main navigation" })
      .waitFor();
    // Simulate visibility transitions explicitly; headless pages do not reliably
    // become hidden when another tab is foregrounded.
    await restorePage.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new window.Event("visibilitychange"));
    });
    await restorePage.clock.setSystemTime(
      new Date((await restorePage.evaluate(() => Date.now())) + 61000),
    );
    await restorePage.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: false,
      });
      document.dispatchEvent(new window.Event("visibilitychange"));
      delete document.hidden;
    });
    await restorePage
      .getByRole("heading", { name: "Welcome back", exact: true })
      .waitFor();
    results.simulatedHiddenResumeLockWithoutTimer = true;
    results.privateInputAttributes = true;
  } finally {
    await restoreContext.close();
  }
  assert.deepEqual(errors, [], "No runtime/console errors");
  assert.deepEqual(network, [], "No HTTP(S) requests from the extension");
  results.runtimeErrors = errors;
  results.runtimeHttpRequests = network;
  results.status = "passed";
  await writeFile(
    "test-results/browser-report.json",
    JSON.stringify(results, null, 2),
  );
  console.log(
    JSON.stringify({ ...results, imageEvaluation: summary }, null, 2),
  );
} catch (error) {
  if (page) await screenshot("failure").catch(() => {});
  console.error(error);
  throw error;
} finally {
  await context.close();
}
