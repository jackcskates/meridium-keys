# Implementation Status

Last verified: 2026-09-10.

## Working now

- Local Vite, React, and TypeScript development environment.
- Installable PWA shell with offline application assets, regular and maskable
  Meridium icons, iOS standalone metadata, native Chromium install prompting,
  iPhone/iPad installation guidance, and an explicit update prompt. Installed
  clients check for a new service worker at launch, when returning to the
  foreground, and when connectivity returns.
- Phone install icons now use the same approximately 70-percent Meridium-mark
  scale as desktop icons, with cache-busted manifest and Apple touch references.
- Phone safe-area handling plus live online/offline Dropbox status and automatic
  Dropbox session restoration after the user authorizes the device once.
- Temporary session App Lock with a slow PBKDF2 verifier and explicit Lock App
  action. The plaintext app password is not committed.
- Mobile-safe App Lock input disables capitalization and correction, accepts
  accidental whitespace around a pasted value, retains failed input for
  correction, and distinguishes the app password from vault master passwords.
- Vault master-password fields disable iOS capitalization, correction, spelling,
  and site-password autofill even while revealed. Failed unlock attempts retain
  the entered value for inspection and correction while preserving byte-exact
  KDBX password matching.
- Responsive Meridium application frame with a collapsible vault sidebar.
- Home navigation naming, icon-free storage section labels, explicit green
  Dropbox-ready status, and a bottom placeholder profile/sign-out area.
- Home now presents only two large side-by-side landing actions—create a new
  vault or open a device KDBX file—without repeating the Dropbox vault library.
  Dropbox vault deletion remains available from the sidebar.
- Local `.kdbx` selection with extension and 64 MB size validation.
- Read-only KDBX 4 unlock for password-protected Argon2id, Argon2d, and AES-KDF vaults.
- Key derivation and KDBX parsing in a dedicated web worker.
- In-memory mapping of the KDBX root, nested folders, typed entries, and safe
  entry summaries. The vault root is represented as “No folder,” not as a
  duplicate folder named after the vault.
- Three-pane group, entry, and detail browser on desktop, with a stacked phone layout.
- Masked protected-field presence without extracting protected values into the
  React snapshot.
- Direct Copy controls beside every populated protected field in the selected
  entry. A click asks the worker for only that field and writes it to the system
  clipboard without opening Edit or storing the plaintext in React state.
- Conventional workspace utilities now use 44-pixel icon-only controls from the
  shared symbol vocabulary, with explicit accessible names: Back, Lock, Add,
  Create folder, Copy, Edit, Move, and Delete. Form submission and destructive
  confirmation actions keep visible labels.
- Explicit lock that removes the decrypted snapshot from application state.
- Safe wrong-password, invalid-file, unsupported-format, corrupt-file, timeout, and worker errors.
- Dropbox App Folder authorization using OAuth authorization code with PKCE and
  offline access. The refresh token is AES-GCM encrypted before IndexedDB storage;
  short-lived access tokens remain memory-only.
- Recursive discovery of standard KDBX files in the app folder.
- Direct download of selected encrypted KDBX bytes into the existing local unlock worker.
- Creation of standard KDBX 4 vaults with Argon2id in the dedicated crypto worker.
- Conflict-safe upload of a newly created vault to the Dropbox App Folder without overwriting an existing name.
- Dropbox upload-success parsing accepts the direct file metadata shape returned
  by `files/upload`; if that metadata is incomplete, the app refreshes the
  folder and reconciles the newly saved vault by filename.
- Immediate transition to the new vault's unlock screen after Dropbox confirms the upload.
- Live password guidance during vault creation with individually resolved
  requirements, confirmation matching, and duplicate vault-name detection.
- Vault removal from the Dropbox library without opening the vault or knowing
  its master password, with a named destructive confirmation and revision check.
- Create and rename KDBX folders while a Dropbox vault is unlocked. Folder
  actions live in a per-folder overflow menu. Delete is disabled and rejected
  when the folder contains entries or child folders; empty folders move to the
  standard KDBX Recycle Bin.
- Type-first create and edit flows for Note, Login, Account, Database, Password,
  API Key, Identity, Membership, Crypto Wallet, and Serial Number entries.
  Each type supplies its own field set; standard fields and protected custom
  fields remain readable in compatible KeePass applications. Lucide type icons
  precede entry titles in the folder navigator, entry list, type picker, and
  selected-entry header.
- A right-side Generate action on service password fields creates a securely
  randomized 20-character value with guaranteed uppercase, lowercase, number,
  and compatibility-focused symbol characters.
- Delete entries into the standard KDBX Recycle Bin with explicit confirmation.
- Move entries between real KDBX folders or back to “No folder” by dragging the
  dedicated handle with a mouse or touch pointer. A Move entry dialog provides
  the equivalent keyboard-accessible action. Recycle Bin is never a move target.
- Folder navigation lists created folders first, followed by each entry stored
  outside a folder by name. The unfiled-entry area accepts drops, while Recycle
  Bin remains docked to the bottom when the folder list scrolls.
- Revision-safe Dropbox updates: an edit is uploaded only over the revision that
  was opened, and the in-memory worker commits it only after Dropbox confirms.
- Explicit connected, connecting, loading, empty, error, and session-disconnect states.
- Dropbox developer settings verified with production and local PKCE callback
  URIs; an end-to-end authorization returned to the PWA and loaded the empty
  App Folder successfully.

## Verified boundaries

- The browser receives a `File` selected by the user and does not upload it.
- The master password is read from an uncontrolled form, sent to the worker, and the form is reset immediately.
- The rendered snapshot contains entry title, type, safe subtitle, folder
  metadata, and the keys of populated protected fields. It never contains their
  values. The worker returns one plaintext protected value only in response to
  its explicit Copy action; entry editing remains the only operation that loads
  the complete typed entry into volatile React state.
- Reveal outside the entry editor, search, local encrypted caching, automatic
  clipboard clearing, and recovery are not part of this slice.
- Local device files remain read only because a browser file selection does not
  grant safe overwrite access. Dropbox vaults support revision-safe entry updates.
- The service worker precaches versioned app-shell assets only; it has no runtime
  caching rule for Dropbox responses, vault files, tokens, or decrypted data.
- No production credentials or real vault samples are committed.
- The temporary client-side App Lock deters casual access only. It is not a
  server authentication boundary and does not yet encrypt persistent data.

## Compatibility evidence

- Automated fixtures cover KDBX 4 with Argon2id and AES-KDF.
- Wrong-password, malformed-file, empty-password, protected-value
  non-disclosure, one-field protected reads, and clipboard-path tests pass.
- A newly generated KDBX 4 vault is reopened with its chosen master password and rejected with a wrong password in automated compatibility tests.
- The corrected local PWA completed a live Dropbox creation on 2026-09-10:
  it encrypted a uniquely named test vault, uploaded it to the scoped App Folder,
  refreshed the two-vault library, and reopened the resulting KDBX 4 file with
  its test password.
- A second isolated live Dropbox vault completed the full entry lifecycle on
  2026-09-10: add, encrypted upload, lock/reopen, edit, encrypted upload,
  lock/reopen, delete to KDBX Recycle Bin, encrypted upload, and lock/reopen.
  The isolated test vault was then deleted through the new in-app vault-removal
  confirmation; the existing Development vault was not modified.
- A separate locked test vault was created, returned to the library without ever
  being unlocked, and deleted through the in-app confirmation without entering
  its master password. The Development vault remained the only Dropbox vault.
- A temporary KDBX 4 fixture generated by the independent PyKeePass implementation was opened through the running browser UI, rendered with its secret masked, explicitly locked, and rejected with the wrong password.
- The production build and dependency audit pass with no reported vulnerabilities.
- A fresh browser session accepted the configured temporary App Lock password
  with deliberate leading and trailing paste whitespace after the mobile-input
  correction, then restored the Dropbox library normally.
- The built PWA manifest, standalone identity/scope, service worker, iOS metadata,
  Apple touch icon, and regular and maskable install icons pass an automated
  artifact check.
- Automated Dropbox tests cover PKCE request/code exchange, cursor pagination,
  KDBX filtering, account identity, byte-preserving download, the direct upload
  response shape, incomplete-metadata reconciliation, no-overwrite creation,
  name conflicts, revision-safe update and delete requests, conflicts, and
  expired-token errors, offline-access request and refresh, and encrypted
  refresh-token storage. KDBX tests reopen added, edited, and deleted entries,
  folder lifecycle changes, and all ten typed-entry schemas.
- A disposable live Dropbox vault completed folder create/rename, type-first API
  Key creation in “No folder,” entry edit and move, and the earlier non-empty
  folder recycle behavior on 2026-09-10. D-032 subsequently replaced that
  deletion behavior with an empty-folder-only rule enforced by automated tests.
  The disposable vault was removed afterward and Development was not modified.
- A second disposable live Dropbox vault verified the drag interaction itself on
  2026-09-10: a root Note entry was dragged by its handle into another folder,
  the folder counts and selected-entry metadata updated after the Dropbox save,
  and the test vault was removed afterward. Development remained untouched.
- A third disposable vault verified the reverse interaction and navigator layout:
  a Note was created in References, dragged into the unfiled-entry area, rendered
  by name beneath References, and left Recycle Bin docked at the panel bottom.
  The test vault was removed and Development remained untouched.
- A fourth disposable Dropbox vault verified the password-generator UI and save
  path: generate, reveal for character-class inspection, encrypted save,
  lock/reopen, and protected-field presence after reopen. The test vault was
  removed and Development remained untouched.
- A fifth disposable Dropbox vault verified the D-032 folder and icon behavior
  in the running app: Rename and Delete appeared only after opening the folder
  overflow menu, Delete was disabled while a Note remained inside, the Note used
  its Lucide icon before the title, and Delete became available after the entry
  was moved to Recycle Bin. The empty folder and test vault were removed;
  Development was not opened or modified.

## Current dependencies for vault reading

- `kdbxweb` parses standard KDBX files.
- `hash-wasm` supplies Argon2d and Argon2id in the crypto worker.
- Patched `@xmldom/xmldom` supplies XML APIs unavailable in web workers.

These are implementation choices, not a proprietary storage layer. The user-owned file remains standard KDBX.

## Next safe slice

Bind the persisted Dropbox credential to the per-device App Lock envelope, then
add encrypted offline KDBX caching. Search, copy/reveal, password generation,
automatic locking, and explicit multi-client conflict recovery remain separate
security and UX slices.
