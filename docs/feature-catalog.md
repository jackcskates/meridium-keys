# Feature Catalog

This catalog separates committed product behavior from recommendations and
future possibilities.

## Vault management

**Confirmed:**

- Display multiple vaults as icons in a left-side rail.
- Add a vault.
- Remove a vault.
- Give every vault its own master password.
- Keep vault lock state independent.
- Unlock a vault with its master password.
- Provide a 12-word recovery path for each vault.

**Implemented:**

- Create a standard KDBX 4 vault with an independent master password.
- Upload a new vault to the connected Dropbox App Folder without overwriting an existing file.
- Select and unlock a local standard KDBX 4 vault.
- Browse folders and typed entry summaries without exposing protected values.
- Mask password presence and explicitly relock the vault.
- Keep decryption and key derivation in a dedicated worker.
- Remove a Dropbox vault without unlocking it, after a named confirmation.
- Create and rename folders. Delete only empty folders through the folder's
  overflow menu, using standard KDBX recycle behavior.
- Keep entries directly in the vault root through the explicit “No folder” choice.
- Create and edit all ten confirmed entry types through type-specific forms.
- Identify every entry type with its own Lucide icon before the entry title.
- Delete entries into the standard KDBX Recycle Bin.
- Drag entries between real folders or “No folder” with mouse or touch, with a
  keyboard-accessible Move entry dialog for the same operation. The Recycle Bin
  is not a valid drop destination.
- List created folders before individually named unfiled entries and keep the
  Recycle Bin docked at the bottom of the navigator.

**Proposed:**

- Give each vault a user-selected icon key stored as non-sensitive metadata in
  `metadata/vaults.json`, keyed by stable Dropbox file ID. This keeps the icon
  visible while the KDBX file is locked and synchronized across devices.
- After unlock, offer the KDBX root group's standard or custom icon as an import
  choice. Do not require or rewrite that KDBX icon merely to decorate the rail.
- Show locked, unlocked, syncing, offline, conflicted, and error states on the
  vault icon using both text/shape and color.
- Distinguish removing a vault from this device, disconnecting it from the app,
  and deleting its remote file.
- Support automatic lock after inactivity, browser backgrounding, device sleep,
  and an explicit Lock action.

## Search and browsing

**Confirmed:**

- Keyword search across all items in the currently unlocked vault.
- Every result has a name, icon, and item type.

**Implemented so far:**

- Browse folders and entries in the currently unlocked vault.
- Inspect safe type, folder, subtitle, and protected-field presence metadata.
- Choose an entry type first, then create or edit the fields for that type.
- Keyword search is the next slice and is not implemented yet.

**Proposed:**

- Search names, usernames, URLs, tags, notes, and safe type metadata in memory.
- Never build a persistent plaintext search index.
- Provide keyboard-first search and result navigation on desktop.
- Keep the active vault obvious while searching.
- Include useful empty, no-results, locked, offline, and error states.

## Item types and fields

**Confirmed and implemented initial types:**

| Type | Initial fields |
| --- | --- |
| Note | Name, notes |
| Login | Name, username/email, password, website, notes |
| Account | Name, username/email, password, profile URL, recovery email, recovery phone, recovery codes, notes |
| Database | Name, database, host, port, username, password, connection string, notes |
| Password | Name, password, related URL, notes |
| API Key | Name, service, API key, API secret, endpoint, notes |
| Identity | Name, full name, email, phone, address, date of birth, ID number, notes |
| Membership | Name, member number, username, password, website, expiration, notes |
| Crypto Wallet | Name, network, wallet address, recovery phrase, private key, PIN, notes |
| Serial Number | Name, manufacturer, model, serial number, purchase date, warranty expiration, notes |

The type is stored as a friendly custom KDBX field. Common values use standard
KDBX fields; additional named and protected fields remain visible to third-party
KeePass applications without requiring a proprietary file format.

## Secret interactions

**Confirmed:**

- Mask secret values by default.
- Copy a secret.
- Reveal a secret.
- Change a secret.
- Generate a password.

**Implemented so far:**

- Generate a 20-character service password from the password field's trailing
  action using the browser cryptographic random source.
- Guarantee at least one uppercase letter, lowercase letter, number, and symbol
  while limiting symbols to a broadly accepted service-compatible set.
- Keep generated values inside the unsaved editor draft until the user saves or
  cancels the entry.
- Copy any populated protected field directly from the selected-entry detail
  view without opening Edit. Each value remains masked; only the requested
  field is decrypted by the vault worker and handed to the system clipboard.

**Proposed:**

- Make reveal temporary and reset it when the item, vault, or tab loses focus.
- Clear copied secrets from the clipboard after a configurable delay where the
  platform permits it.
- Never include secret values in notifications, URLs, DOM identifiers, logs, or
  telemetry.
- Let the generator control length, character groups, ambiguous characters, and
  memorable passphrases.
- Show strength guidance without sending the candidate password to a server.

## Dropbox and offline behavior

**Confirmed direction:**

- Dropbox stores and synchronizes encrypted vault files.
- The Signal Music integration is the architectural reference for Dropbox work.
- The app is local-first and should work offline with a previously cached vault.

**Implemented so far:**

- Connect to the scoped Dropbox App Folder using OAuth code flow with PKCE.
- Request offline access and restore the Dropbox connection automatically from
  an AES-GCM-encrypted refresh credential after the device has been authorized.
- Discover and download standard KDBX files.
- Upload newly created KDBX files with no-overwrite conflict handling.
- Upload edited encrypted KDBX bytes only over the expected Dropbox revision.
- Delete a Dropbox vault only at the revision shown in the library.

**Proposed:**

- Bind the persisted refresh credential to the future per-device App Lock key;
  the current device-local wrapping key provides at-rest protection but is not an
  XSS or compromised-browser-profile boundary.
- Request only metadata read, content read, and content write permissions needed
  for the App Folder workflow.
- Cache encrypted vault bytes and non-sensitive revision metadata in IndexedDB.
- Upload using an expected revision and stop on conflict.
- Provide explicit reconnect, retry, and conflict-recovery states.

## Installable PWA

**Confirmed:**

- The product is a PWA built on Vite, React, and TypeScript.

**Proposed:**

- Installable manifest and platform icons.
- Offline application shell.
- An update prompt so a new application bundle never replaces an active session
  without warning.
- No service-worker caching of Dropbox responses or decrypted vault data.

## Later or unresolved

- Shared vaults with view or edit rights.
- Import from 1Password or other password managers.
- Browser extension and autofill.
- Passkeys, TOTP generation, attachments, secure notes, identities, cards, and
  software licenses.
- Biometric or platform-credential unlock.
- Organization/team administration.

These are not version-one commitments.
