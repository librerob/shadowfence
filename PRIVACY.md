# Privacy

ShadowFence processes selected images and manually entered text locally. It has no backend,
account system, telemetry, analytics or runtime network API calls. Its extension Content Security
Policy forbids connections. Opening the source-code link in About navigates a separate browser tab
to GitHub; that navigation is a normal website visit.

The vault contains identity names, descriptions, colors, image labels, SHA-256 and perceptual
fingerprints, identifiers, and the selected identity. Those records are encrypted together in
IndexedDB. Original images, filenames, checked text and previews are not persisted. No data is
written to Chrome sync or `chrome.storage`. No browser permissions are requested.

Only the encrypted envelope's format, KDF parameters, random salt/nonce, ciphertext length and
revision are visible while locked. Appearance settings are unencrypted in localStorage. The
database's existence, approximate size and write times can be observable to someone with device
access. Backups contain the same encrypted envelope.

An open tab necessarily holds decrypted records and a non-extractable CryptoKey in memory.
Locking drops application references and clears the rendered workspace; JavaScript cannot promise
secure physical memory erasure. No keys are saved in session storage or a background service worker.
Tabs lock after five minutes idle or one minute hidden, and when closed. Expiration is also checked
on return and before accepting new activity. Locking broadcasts to open tabs. A save
in another tab invalidates older sessions so they cannot silently overwrite it.

Uninstalling the extension removes its local database. Settings can delete the vault. Downloaded
backups and browser/OS backups remain separate; remove those yourself if no longer wanted.
Deleting a record does not guarantee forensic erasure from browser storage or system snapshots.

There are no site permissions, content scripts, upload interception, external message listeners or
web-accessible extension resources. Your browser still needs its ordinary network access to install
updates or visit websites. Development tools download dependencies and test browsers; those are
not part of normal extension operation.

Sensitive text fields disable browser spellcheck, autocorrection, capitalization and form
autocomplete. Password fields retain password-manager hints. These controls do not govern OS
keyboards, input methods or software with access to your device.
