# Vault format and upgrades

Version 0.2 writes envelope version 2. All identity data remains one AES-256-GCM ciphertext.
The plaintext schema remains version 1; image fingerprints and matching rules do not change.

## Version 2

The JSON fields are `format`, `version`, `kdf`, `salt`, `iv`, `ciphertext` and `revision`.
`format` is `shadowfence`; `version` is 2. The only accepted KDF profile is:

```json
{"name":"argon2id","version":19,"memoryKiB":65536,"iterations":3,"parallelism":1}
```

Argon2id returns 32 bytes. A fresh 16-byte random salt is created for a new vault, migration or
passphrase change. Passphrase UTF-8 bytes are used exactly as entered. The result is imported as
an AES-256-GCM CryptoKey with `extractable: false` and encrypt/decrypt usages. Saves reuse that
session key and salt, with a new random 12-byte IV and UUID revision on every encryption.

AES-GCM uses a 128-bit tag. Its additional authenticated data is the UTF-8 encoding of the
following JSON array, with no whitespace, in this exact order:

```text
[format,version,kdf.name,kdf.version,kdf.memoryKiB,kdf.iterations,kdf.parallelism,salt,iv,revision]
```

Salt, IV and ciphertext use standard padded Base64. JSON object property order is immaterial.
The header is authenticated, not encrypted; ciphertext length and product identification remain
visible. Imports reject unsupported versions or KDF parameters before key derivation, rather
than clamping them and trying to decrypt a different profile. Salt/IV string lengths and the
12,000,000-character ciphertext limit are checked before decoding.

## Worker and dependency

A fresh module worker derives each Argon2 key using pinned `@noble/hashes` 2.4.0. The 64 MiB
matrix is temporary. Mutable password/key buffers are cleared on the successful path, and the
library clears its working matrix. Only a non-extractable CryptoKey is cloned back to the page;
the raw derived bytes are not posted back. The worker terminates on success, error, a 60-second
timeout, page teardown or vault lock. JavaScript cannot guarantee physical memory erasure.

This is pure JavaScript bundled in the extension. The CSP, zero-permission manifest and denied
runtime network connections remain unchanged. No WASM execution is enabled.

Tests check the library against [RFC 9106 section 5.3](https://www.rfc-editor.org/rfc/rfc9106.html#section-5.3)
and the production profile against hash-wasm 4.12.0. The latter was used only for development;
it is not a runtime or build dependency. Three local Node 24 measurements of the same 64 MiB,
three-pass, one-lane operation were 758-825 ms for JavaScript and 182-207 ms for WASM. These are
single-machine observations, not browser or low-end-device guarantees. Browser evidence records
actual bundled-worker timing and verifies the page event loop stays responsive.

The library's published 2022 audit excluded Argon2. Known-answer and integration tests do not
constitute an independent cryptographic audit.

## Version 1 compatibility

Version-1 envelopes use PBKDF2-HMAC-SHA-256 at exactly 600,000 iterations, a 16-byte random salt,
and fixed AAD `ShadowFence vault v1`. Existing encrypted records and backups remain readable.

Unlock first authenticates and schema-validates a version-1 record. Only then does it derive an
Argon2 key with a fresh salt and encrypt version 2. An IndexedDB compare-and-replace transaction
commits against the old revision. Wrong passphrases, failed writes and competing saves leave the
old record untouched. The workspace opens only after a successful commit, and other open tabs
are invalidated. A version-2 unlock authenticates without rewriting the stored record.

Restoring a version-1 backup performs the same conversion before the first write. Restore still
requires an empty installation. A new version-2 backup requires ShadowFence 0.2 or later. Older
backup files keep their original encryption and passphrase; upgrading the live vault cannot
upgrade or erase those separate files.
