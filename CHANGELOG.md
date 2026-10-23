# Changelog

## 0.2.0

- Derive new vault keys with Argon2id: 64 MiB, three passes, one lane.
- Upgrade authenticated version-1 vaults and restores atomically with a fresh salt.
- Bind version-2 headers to AES-GCM and reject unsupported KDF profiles before work.
- Run derivation in a disposable, cancellable worker with no CSP expansion.
- Add RFC and independent known-answer checks plus migration and cancellation browser tests.

New backups require version 0.2 or later. Earlier backups remain readable and retain their original
encryption.

## 0.1.1

- Disable spellcheck, autocorrection and form autocomplete on sensitive text fields.
- Lock after one minute hidden and check expiration on resume and before interaction.
- Start inactivity timing at successful unlock or restore.

## 0.1.0

- Add encrypted local identities, image registrations and identifier management.
- Add exact and paired perceptual image checks, with visible cross-identity reuse.
- Add explicit text checking, idle/global locking, passphrase changes and encrypted backups.
- Add the dedicated workspace and quick-action popup, four theme modes and six accents.
- Add unit tests, production-extension browser tests, image evaluation fixtures and package checks.

No automatic upload blocking, face recognition, AVIF support or cloud services are included.
