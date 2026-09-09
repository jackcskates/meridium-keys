# Product Brief

## Product

**Meridium Keys** is an installable, local-first password vault PWA for managing
multiple independently secured vault databases.

## Primary user and goal

**Confirmed:** The initial product is being designed around the owner's personal
credential-management workflow. The primary job is to find and use a stored
credential quickly without weakening the security of the vault that contains
it.

## Core product model

**Confirmed:**

- Meridium Keys does not require a separate application login.
- The initial entry flow connects Dropbox, creates a vault, or opens an existing
  KDBX vault.
- The application can contain multiple vaults.
- Every vault is independent and has its own master password.
- Unlocking one vault does not unlock another.
- Vaults appear as icons in a left-side rail.
- A user can add and remove vaults.
- An unlocked vault can be searched by keyword.
- Stored items have a name, icon, type, and type-specific fields.
- Initial item types include Login, Password, and API Key.
- Additional item types can be added later.
- Secret values are masked and can be copied, revealed, and changed.
- The product includes a password generator.
- Each vault is intended to have a 12-word recovery mechanism.
- Standard KDBX files must remain openable in compatible third-party apps.
- The interface is optimized for a compact desktop window and a full-screen,
  installed phone PWA.

## Product principles

- **Local-first:** core vault access should continue when Dropbox or the network
  is unavailable, provided the encrypted vault is already on the device.
- **Vault independence:** credentials, recovery, lock state, and sync status are
  scoped to one vault.
- **Encrypted everywhere outside memory:** Dropbox and browser persistence hold
  encrypted vault bytes, not readable entries.
- **Fast retrieval:** unlock, search, copy, and return to work with minimal
  navigation.
- **Visible trust state:** the active vault, lock state, and sync state should
  never be ambiguous.
- **Interoperability before lock-in:** standard KDBX compatibility is strongly
  recommended but remains an open product decision.
- **Clarity before novelty:** familiar patterns and precise language take
  precedence over decorative UI.

## Scope boundaries

**Confirmed for the first product direction:**

- Installable PWA.
- Multiple independently encrypted vaults.
- Dropbox-backed encrypted-file synchronization.
- Search and credential operations within an unlocked vault.

**Carried-forward context to validate:**

- The first release is single-user and intended to replace the owner's existing
  1Password 7 workflow.
- A future release may share vaults with view or edit permission.
- Dropbox may use an App Folder displayed as `Apps/Meridium Keys`.

These items appeared in earlier design context but have not yet been reconfirmed
as current requirements.

## Success criteria for version one

**Proposed:**

- A new user can connect Dropbox and see available encrypted vaults.
- Each vault can be independently unlocked, searched, edited, saved, and locked.
- The same supported vault opens successfully in the agreed third-party KeePass
  applications when interoperability is enabled.
- Offline use never requires plaintext persistence.
- Conflicting Dropbox revisions are detected and resolved without silently
  overwriting a newer vault.
- Keyboard, touch, screen-reader, zoom, and contrast behavior meet the agreed
  accessibility baseline.
