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
- Browse groups, entry names, usernames, and URLs without exposing protected passwords.
- Mask password presence and explicitly relock the vault.
- Keep decryption and key derivation in a dedicated worker.
- Remove a Dropbox vault without unlocking it, after a named confirmation.
- Add and edit Login-compatible entries in unlocked Dropbox vaults.
- Delete entries into the standard KDBX Recycle Bin.

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

- Browse groups and entries in the currently unlocked vault.
- Inspect safe Login-compatible metadata in a read-only detail pane.
- Create and edit Login-compatible title, group, username, password, website,
  and notes fields in an unlocked Dropbox vault.
- Keyword search is the next slice and is not implemented yet.

**Proposed:**

- Search names, usernames, URLs, tags, notes, and safe type metadata in memory.
- Never build a persistent plaintext search index.
- Provide keyboard-first search and result navigation on desktop.
- Keep the active vault obvious while searching.
- Include useful empty, no-results, locked, offline, and error states.

## Item types and fields

**Confirmed initial types:**

- **Login:** a credential used to sign in to a service.
- **Password:** a standalone secret without a required username or URL.
- **API Key:** a developer or service credential.
- **Extensible types:** the system must allow more types to be added.

**Proposed initial fields:**

| Type | Fields to validate |
| --- | --- |
| Login | Name, username/email, password, website, notes, tags |
| Password | Name, password, notes, tags |
| API Key | Name, key/token, service, environment, expiry, notes, tags |

The exact schema is open. Type-specific fields must map cleanly to the chosen
vault file format without losing data in third-party applications.

## Secret interactions

**Confirmed:**

- Mask secret values by default.
- Copy a secret.
- Reveal a secret.
- Change a secret.
- Generate a password.

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
- Discover and download standard KDBX files.
- Upload newly created KDBX files with no-overwrite conflict handling.
- Upload edited encrypted KDBX bytes only over the expected Dropbox revision.
- Delete a Dropbox vault only at the revision shown in the library.

**Proposed:**

- Use Dropbox OAuth authorization code + PKCE.
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
