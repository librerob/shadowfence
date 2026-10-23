# Implementation research

Reviewed 22 October 2026. This was a bounded implementation review, not an exhaustive market survey.

## Browser platform and design

- [Chrome API reference](https://developer.chrome.com/docs/extensions/reference/api): no supported
  general API exposes the selected toolbar theme accent to ordinary extensions. ShadowFence uses
  [`prefers-color-scheme`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-color-scheme)
  and manual accent roles. It makes no claim of exact theme synchronization.
- [Manifest V3 CSP](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy):
  local packaged scripts; no inline JavaScript or remote execution. Connections are denied.
- [Extension storage](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies):
  IndexedDB supports local extension storage without the `storage` permission. No `chrome.storage`
  means no content-script storage access level to configure.
- [Popup behavior](https://developer.chrome.com/docs/extensions/develop/ui/add-popup): focus loss closes
  popups. Checks and unlocked keys live in a dedicated app tab; the popup only opens workflows.
- [Material 3 color roles](https://m3.material.io/styles/color/roles): centralized role tokens,
  tonal navigation, restrained surfaces, rounded controls and a small local component system.
- [Playwright extension testing](https://playwright.dev/docs/chrome-extensions): persistent Chromium
  profiles support loading an unpacked production build. Chrome/Edge command-line sideloading is
  restricted, so CI uses Playwright's Chromium distribution.
- [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html):
  PBKDF2-HMAC-SHA-256 at 600,000 iterations supplies an available Web Crypto KDF. This does not
  make human-chosen short passphrases resistant to offline guessing.
- [ImageHash reference implementation](https://github.com/JohannesBuchner/imagehash/blob/master/imagehash/__init__.py):
  classic DCT pHash and horizontal dHash informed the locally implemented algorithms. This
  implementation excludes DC, pairs both hashes, and versions its normalization; hashes are not
  promised interoperable with that library.

## Related products

| Project | Relationship | Difference relevant to ShadowFence |
| --- | --- | --- |
| [Firefox Multi-Account Containers](https://addons.mozilla.org/en-US/firefox/addon/multi-account-containers/) | Partial overlap: separate online contexts | Isolates website storage and cookies; its documented feature set does not provide a local cross-identity image registry. |
| [Search by Image](https://github.com/dessant/search-by-image) | Related image-reuse discovery | Offers reverse-image searches through search engines, rather than an offline user-defined identity vault. |
| [Image Privacy Cleaner](https://chromewebstore.google.com/detail/image-privacy-cleaner/ddadbhinlpcoddlajlglppgpicndhdpl) | Related disclosure prevention | Removes image metadata; visual material can remain linkable after metadata removal. |
| [ImageHash](https://github.com/JohannesBuchner/imagehash) | Related implementation technology | Image-hashing library rather than an identity-management browser extension. |

Queries covered Chrome Web Store, Firefox Add-ons, GitHub, GitLab and Codeberg for image reuse,
perceptual matching and identity separation. GitLab queries did not yield a verified directly
comparable extension; Codeberg was blocked by the research browser's robots policy. These gaps
are not evidence that alternatives do not exist. No verified direct equivalent emerged from this
limited search. ShadowFence makes no novelty or “world's first” claim.

Automatic integrations with Reddit/X were deferred: file input changes do not reliably precede
network upload, and content scripts cannot universally guarantee interception. The initial release
therefore uses explicit pre-upload checks with no site access.

## Vault hardening review - 23 October 2026

- [Chrome spellcheck](https://support.google.com/chrome/answer/12027911): enhanced spellcheck
  can send entered text to Google. Sensitive text fields now opt out of browser spellcheck,
  autocorrection and autocomplete. Password fields keep password-manager purpose hints.
- [OWASP KDF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
  prefers memory-hard Argon2id. Version 0.2 uses a fixed 64 MiB, three-pass, one-lane profile,
  with the original PBKDF2 path only for authenticating older vaults before migration.
- [noble-hashes implementation](https://github.com/paulmillr/noble-hashes): pinned 2.4.0, pure
  JavaScript, no transitive runtime dependencies and no CSP expansion. Its published 2022 audit
  excluded Argon2. We do not describe the Argon2 implementation as independently audited.
- [RFC 9106 section 5.3](https://www.rfc-editor.org/rfc/rfc9106.html#section-5.3) supplies a
  known-answer test. Production parameters were also cross-checked with
  [hash-wasm 4.12.0](https://github.com/Daninet/hash-wasm), used only during development.
- [Vault format](VAULT-FORMAT.md) records header authentication, resource bounds, migration and
  compatibility. The dependency lockfile and distributed third-party notices include noble-hashes.
