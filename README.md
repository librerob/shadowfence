# ShadowFence

Check whether a photo or piece of text could connect identities you want to keep separate.
ShadowFence is a Chrome extension that compares files against references you register under
identities such as Personal, Anonymous, and Work. Processing happens on your device.

## What it does

- Custom identities with image fingerprints and identifying strings.
- Exact file matching with SHA-256, plus paired pHash and dHash similarity checks.
- Manual text checks for registered emails, usernames, handles and other identifiers.
- An encrypted local vault, passphrase unlocking, idle locking and encrypted backups.
- A compact popup and dedicated workspace, with System, Light, Dark and AMOLED appearance
  and six accent presets.

There are no accounts, telemetry, servers, site integrations or browser permissions.
ShadowFence does not intercept uploads. **Check a file before selecting it on a website.**

## Installation

Chrome 120 or newer is required. The extension has not been submitted to the Chrome Web Store.

1. Download `shadowfence-0.1.0.zip` from [Releases](https://github.com/librerob/shadowfence/releases).
2. Extract the ZIP to a folder you intend to keep. `manifest.json` must be directly inside it.
3. Open `chrome://extensions` and turn on **Developer mode**.
4. Choose **Load unpacked** and select that extracted folder.
5. Open ShadowFence from the extensions menu. Choose **Open workspace**.

If a release is not available, build from source below and load the `dist` folder.
Moving or deleting the loaded folder breaks an unpacked installation. Uninstalling the extension
removes its local vault; export an encrypted backup before reinstalling.

## Usage

Create a vault with a long, unique passphrase. There is no passphrase recovery.
Create at least two identities, then register photographs and identifiers you have already used
under each one. Image labels are optional. Original photos and filenames are not saved.

Choose the identity you intend to share as, then open **Check image** or **Check text**.
An exact match under another identity is a collision warning; perceptual similarity asks you to
review the result. Registering intentional reuse makes the shared association visible and keeps
the cross-identity warning. A match confined to the current identity does not cause a warning.

Export encrypted backups in Settings. Restore a backup from the welcome screen in a fresh
installation, using the passphrase that protected it when exported. Changing your passphrase
does not change older backups.

## How it works

SHA-256 identifies identical bytes, irrespective of filename. For visual comparison, the image
is decoded locally, reduced to luminance, and fingerprinted with a 63-bit DCT pHash and 64-bit
horizontal dHash. Both similarity thresholds must be met. Low-detail images use exact matching
only, because their perceptual fingerprints are not distinctive enough.

Still JPEG, PNG and WebP are supported, up to 16 MB and 24 megapixels, with a 10,000-pixel limit
on either side. Processing runs in a disposable worker with a timeout. AVIF is not supported in
this release. [Matching notes](docs/MATCHING.md) describe the method and evaluation limits.

Text checks use Unicode NFKC normalization, case-insensitive comparison and token boundaries.
They do not detect writing style, semantics, obfuscated identifiers or unregistered information.

## Privacy and limitations

All identity records, labels, identifiers and fingerprints are encrypted together in IndexedDB
with AES-256-GCM. PBKDF2-SHA-256 derives a non-extractable key from your passphrase using
600,000 iterations and a random salt. Each save uses a fresh nonce.

Keys and decrypted records stay in the open workspace tab. Closing or reloading it locks that
session; five minutes without interaction also locks it. Explicit locking locks other open
workspaces. Each tab must be unlocked separately. The popup opens a workspace without reading
your identities. Appearance preferences are stored unencrypted.

System appearance follows the available light/dark preference. Chrome's documented extension
APIs do not expose its exact toolbar accent; manual presets supply the accent colors. Typography
uses local system fonts, with no font download.

**A clear check does not guarantee anonymity.** Cropping, rotation, screenshots and substantial
editing can evade detection. The extension knows only your registered references. It does not
recognize faces, find different photographs of the same person, search the internet, hide your IP,
isolate cookies, strip metadata or prevent browser fingerprinting.

Encryption cannot protect an unlocked session or compromised device, and weak passphrases can
be guessed offline. Perceptual fingerprints can reveal similarity if obtained in decrypted form.
See [Privacy](PRIVACY.md) and the [threat model](docs/THREAT-MODEL.md).

## Development

Use Node.js 22 or newer and npm.

```sh
npm ci --ignore-scripts
npm run check
npx playwright install --with-deps chromium
npm run test:browser
npm run package
```

`npm run dev` opens a local development server; load `app.html` for the workspace. Extension-only
behavior must be tested from `dist`, installed in Chromium. The browser suite does this using a
separate test profile. It also generates real screenshots and an image evaluation report under
`test-results`. The browser test setup downloads checksum-pinned public-domain/CC0 photographs
on its first run; the extension itself does not fetch them. `npm run package` verifies the ZIP
structure and writes it with a checksum to `release`.

Rollup and esbuild use their official WebAssembly packages for a portable build. Runtime
dependencies are React and React DOM, bundled locally. The UI, tokens, SVG symbols and branding
are part of the source. `node scripts/icons.mjs` regenerates PNG icons from the SVG master.

See [Contributing](CONTRIBUTING.md), [Security](SECURITY.md) and [research notes](docs/RESEARCH.md).

## License

GPL-3.0-or-later. See [LICENSE](LICENSE). Test photographs have their own public-domain/CC0
[source credits](tests/fixtures/SOURCES.md). Dependency licenses are preserved in distributed bundles.
