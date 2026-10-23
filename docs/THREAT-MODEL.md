# Threat model

ShadowFence is a manual reference checker. Its aim is to catch accidental reuse, not to establish
an identity or provide anonymity against a determined investigator.

| Threat | Boundary and remaining risk |
| --- | --- |
| Accidental identity correlation | Cross-identity warnings compare only registered references. Context, writing style, metadata, IP addresses and unknown images remain outside coverage. |
| Theft of browser storage or backups | AES-GCM authenticates encrypted records; Argon2id raises the cost of passphrase guessing (legacy records use PBKDF2). A weak passphrase, rollback to an older valid backup, storage deletion and file-size leakage remain possible. |
| Malicious websites | Zero host permissions, no content scripts, no external messaging and no web-accessible resources. Websites cannot ask the extension to scan content or read records. The user can still accidentally upload to them. |
| Malicious image files | Raster signature/dimension checks precede decoding. 16 MB / 24 MP / 10,000px limits, batch limits, disposable workers, timeouts and bitmap cleanup bound routine resource use. Decoder vulnerabilities and brief decode-time memory spikes remain browser risks. |
| Unsafe messaging | There is no runtime message API. The image worker accepts a Blob and returns a validated, fixed-schema fingerprint. BroadcastChannel carries only invalidation signals on the extension origin. |
| Concurrent tabs | IndexedDB compare-and-replace checks the encrypted record revision atomically. Other tabs lock after a save; stale edits fail rather than replace newer data. |
| Compromised dependencies or extension update | A lockfile, CI audit, immutable workflow action refs and no remote runtime code reduce exposure. A malicious shipped extension can access an unlocked vault; encryption does not fix a compromised application. |
| Other malicious extensions or device access | Browser isolation helps but is not a defense against an attacker able to control the browser, inspect an unlocked tab, capture keys/inputs or read process memory. |
| Resource exhaustion | Worker timeout, file/dimension limits, 50-file batches, 100 identities, 200 identifiers per identity and 10,000 total fingerprints. Large reference sets still increase save and matching time. |
| Identifier disclosure | Explicit manual checks retain no analyzed text. Unicode normalization and token boundaries miss obfuscation, some punctuation conventions and semantic disclosures. |

## Encryption details

AES-256-GCM uses 96-bit cryptographically random nonces and 128-bit authentication tags. Every
write encrypts the whole vault with a fresh nonce. Argon2id version 19 uses 64 MiB, three passes,
one lane, a 128-bit random salt and a 32-byte result imported as a non-extractable AES key.
A disposable worker performs derivation; locking aborts it. The CSP still disallows WebAssembly
and runtime connections. Version-2 additional authenticated data binds the format, version, KDF
profile, salt, nonce and revision in a fixed field order. Legacy version-1 records use
PBKDF2-HMAC-SHA-256 at 600,000 iterations and the original fixed version-1 AAD. Passphrase changes create a new salt and key.
Passphrases are used exactly as entered; they are never normalized or persisted.

New passphrases must have 12–1,024 characters. This is a usability floor, not an entropy guarantee.
There is no recovery key. Import validates the bounded envelope before deriving a key, then
authenticates and validates plaintext before writing. Restore is available only when no vault
exists, so a backup cannot silently replace an existing vault.

No Manifest V3 service worker keeps a key alive. Each app tab owns its session. Locking during
an asynchronous operation invalidates its session token. A transaction already committed at the
instant of locking can persist its encrypted result; the UI cannot regain access without unlocking.

Headers and decoders do not constitute a hardened image sandbox. Rejecting oversized advertised
dimensions reduces routine decompression bombs; it cannot eliminate all native decoder risks.
PNG animation is treated as its decoder-selected first frame; animated WebP is rejected.

Older records are authenticated and schema-checked before upgrade. Re-encryption uses a fresh
salt; compare-and-replace commits the result atomically. A failed or stale commit cannot replace
the existing record. Legacy restores upgrade before the first write. Version-2 imports accept only
the exact shipped KDF profile; arbitrary memory/time parameters are rejected before derivation.
Previous backups retain their earlier encryption and passphrase. Migration does not erase copies.

`@noble/hashes` 2.4.0 is pinned and its Argon2id output is checked against RFC 9106 and an
independent implementation. Its published 2022 audit excluded Argon2; these checks are not an
independent security audit of ShadowFence or its Argon2 implementation.
