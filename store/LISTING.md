# Chrome Web Store listing

Prepared for ShadowFence 0.2.1. This is listing copy and review guidance, not a claim that the
publisher dashboard has been completed or the extension has been approved.

## Name

ShadowFence

## Short description

Check for image reuse and identifying text across your identities. Local, encrypted, and offline.

## Detailed description

Check a photo or piece of text before you share it.

ShadowFence compares what you select against references you register under your own identities,
such as Personal, Anonymous and Work. It can flag an image or identifier that you have already
associated with another identity.

What you can do:
- Create identities and register image fingerprints, email addresses, usernames and other identifiers.
- Check JPEG, PNG and WebP images for exact reuse and some visually similar versions.
- Check pasted text for registered identifiers belonging to another identity.
- Keep records in a passphrase-encrypted local vault and export encrypted backups.
- Choose System, Light, Dark or AMOLED appearance and an accent color.

Processing happens on your device. ShadowFence has no account system, backend, analytics or
telemetry, and requests no browser or website permissions. Passphrases are used locally and are
not saved or transmitted. Original images and text you check are not persisted; registered labels,
identifiers and fingerprints are encrypted in your local vault.

Get started:
1. Create a vault with a long, unique passphrase.
2. Create identities and register references you have already used under each one.
3. Select the identity you intend to post as.
4. Check the image or text before uploading or posting it.
5. Export an encrypted backup and keep your passphrase separately.

Checks are limited to your registered references. Cropping, rotation, screenshots and substantial
editing can evade image matching. Text checks can miss obfuscation and unregistered information.
ShadowFence does not recognize faces, search the internet, remove metadata or block uploads.
A clear check does not guarantee anonymity.

There is no passphrase recovery. Uninstalling removes the local vault; export a backup first.

## Links and language

- Language: English.
- Suggested category: Tools, within Productivity if the dashboard groups it there.
- Homepage/source: https://github.com/librerob/shadowfence
- Support: https://github.com/librerob/shadowfence/issues
- Privacy policy: https://github.com/librerob/shadowfence/blob/main/PRIVACY.md
- Security reporting: https://github.com/librerob/shadowfence/security

## Single purpose

Help users spot reuse of registered images and identifying text across their own online identities
through explicit, local checks before sharing.

## Permissions explanation

No browser permissions or host permissions are requested. Users select image files and enter text
manually in the extension's own workspace. Encrypted records use local IndexedDB. There are no
content scripts, upload interception or access to browsing history.

## Remote code explanation

No remote code is used. All JavaScript, React and Argon2id code is bundled in the submitted package.
The extension CSP disallows runtime connections, remote scripts, inline scripts, eval and WASM.
Opening the source-code link creates an ordinary, separate website visit to GitHub.

## Data handling disclosure

This extension handles data locally. Do not describe it as handling no user data simply because
it has no server. Identity names and identifiers, selected image content and pasted text are used
only for the functions requested by the user. Registered records are encrypted locally; original
images and checked text are not persisted. Passphrases are processed transiently for local key
derivation, not stored or sent to a developer or server. No data is sold, transferred for advertising,
used for creditworthiness, or sent to analytics.

Suggested data-type declarations for the publisher to review in the current dashboard:
- Personally identifiable information: names, email addresses, usernames and other identifiers users register.
- Authentication information: the locally entered vault passphrase, transiently used for key derivation.
- Personal communications: user-pasted text may contain a message or bio being checked.
- Website content: user-selected image/text content is explicitly processed; the extension does not read websites.

The exact field labels and help text in the live dashboard control the final selections. Explain
local handling and non-transmission in the privacy policy and reviewer notes. The three Limited Use
certifications are consistent with the shipped implementation; the publisher must review and
certify them in the dashboard.

## Reviewer instructions

No account, subscription, website access or test login is required.

1. Open the extension popup and choose Open workspace.
2. Create a vault with a temporary passphrase of at least 12 characters. Use synthetic data only.
3. Create Personal and Anonymous identities.
4. Under Personal, register any test image and the identifier alex@example.com.
5. Select Anonymous as the current identity. Check the same image: an exact collision is reported.
6. Check the text "Contact alex@example.com": a cross-identity identifier warning is reported.
7. With no other-identity references, checks show a neutral no-reference result.
8. In Settings, export an encrypted backup. Lock and unlock to verify persistence.
9. To test restore, use a fresh test installation/profile with no vault and restore that backup.

All processing can run offline. Developer fixture downloads and build dependencies are not part
of the installed extension. The package has no preloaded identities, photos, passphrases or vault.

## Submission references

- https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
- https://developer.chrome.com/docs/webstore/images
- https://developer.chrome.com/docs/webstore/set-up-account

Reviewed 23 October 2026. Store requirements and dashboard labels can change.
