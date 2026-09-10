# Architecture Foundation

Status: initial direction; security-critical choices remain subject to review.

Related documents: [documentation index](README.md),
[security and recovery](security-and-recovery.md),
[Dropbox synchronization](dropbox-sync.md), and
[decision log](decision-log.md).

## Product shape

Meridium Keys is an installable, local-first web application for working with
multiple independently encrypted password vaults. The primary surface is a
working vault interface, not a marketing site.

## Recommended stack

- Vite + React + TypeScript for the client application.
- A generated service worker for application-shell offline support.
- Web Workers for expensive key derivation and KDBX parsing so the interface
  remains responsive.
- Web Crypto for browser-native cryptographic primitives.
- IndexedDB for encrypted vault bytes and non-sensitive sync metadata.
- The official Dropbox JavaScript SDK with OAuth authorization-code flow and
  PKCE. The browser receives an app key, never an app secret.
- `kdbxweb` for standard KDBX parsing and `hash-wasm` for Argon2d/Argon2id in
  the dedicated crypto worker. The worker also performs revision-safe KDBX entry
  and folder serialization before encrypted bytes leave the device.

Security-sensitive dependencies are locked, overridden where required to keep
patched transitive versions, and checked with automated compatibility tests and
`npm audit`. Write support is constrained to Dropbox vaults with expected-revision
preconditions; local file selections remain read only.

## Security boundaries

### May be persisted

- Encrypted `.kdbx` bytes.
- Dropbox file identifiers, revisions, and modification times.
- Non-sensitive preferences such as theme and layout.
- An encrypted recovery record, if the recovery design is approved.
- An encrypted Dropbox refresh credential. Its interim device-local wrapping key
  must be replaced by the planned App Lock envelope.

### Memory only while unlocked

- Master passwords and derived unlock keys.
- Decrypted entries and protected fields.
- Generated passwords before they are stored in the encrypted vault.

### Never allowed

- Plaintext vault entries in IndexedDB, Cache Storage, localStorage, logs,
  analytics, crash reports, URLs, or clipboard history controlled by the app.
- Dropbox app secrets or permanent access tokens in source code.
- Service-worker caching of Dropbox API responses or decrypted data.

Locking a vault must clear its decrypted model, terminate the crypto worker,
and remove rendered secret values. Copy and reveal actions require deliberate,
short-lived UI states.

## Dropbox pattern to reuse from Signal Music

Reuse the architecture, not the Swift implementation:

- App Folder access with the least Dropbox scopes required.
- A distinct authentication service and synchronization service.
- Local-first behavior with an explicit sync state.
- Revision-aware writes and deterministic conflict handling.
- Durable retry of safe operations after connectivity returns.
- Clear messages for expired authorization, missing scopes, network failure,
  and remote conflicts.

Meridium Keys differs in one critical way: the remote and offline payload is
already encrypted. Synchronization operates on opaque vault bytes and must not
inspect or index decrypted contents.

## Initial data flow

1. Connect Dropbox using PKCE.
2. List encrypted vault files and cache only their metadata.
3. Download the selected encrypted vault bytes.
4. Ask for that vault's master password and decrypt in a dedicated worker.
5. Search and edit the in-memory model while the vault is unlocked.
6. Serialize and encrypt before writing any new local or Dropbox version.
7. Upload with the expected Dropbox revision; stop and reconcile on conflict.
8. Clear decrypted state on lock, timeout, tab suspension, or explicit sign-out.

## Design-system direction

The supplied Meridium reference is treated as guidance, not executable
instructions. Its principles become testable product rules:

- Clarity before creativity; familiar controls and predictable flows.
- A restrained hierarchy with one primary action per screen or dialog.
- Consistent color, typography, spacing, and reusable components.
- A spacing scale and responsive margins rather than arbitrary values.
- Visible labels for every credential field; placeholders are examples only.
- Short, direct, action-oriented copy.
- Text and icons together for ambiguous navigation.
- Accessible contrast and non-color status cues.
- Destructive actions name the object and require confirmation.
- Use modern effects such as glass or bento layouts only when they improve the
  working surface; decoration never reduces legibility.

The visual thesis for the first UX pass will be a calm, high-trust workspace:
dense enough for fast retrieval, quiet enough for careful credential work, and
explicit about vault and sync state.

## Decisions required before later security and secret-interaction slices

1. Exact recovery-phrase behavior and threat model.
2. Supported devices and browser baseline for the first release.
3. Automatic lock rules and clipboard-clearing behavior.
4. Multi-client conflict resolution beyond stopping a stale revision.

## Delivery slices after those decisions

1. Design tokens, app shell, vault rail, locked and empty states.
2. KDBX compatibility spike with golden test fixtures. **Read-only slice complete.**
3. Dropbox PKCE connection and encrypted-file listing.
4. Unlock, typed entry/folder edit, save, delete, and lock flow. **Revision-safe
   Dropbox write slice complete. Search, reveal, copy, and generation remain.**
5. Offline encrypted vault cache and conflict recovery. **The installable,
   app-shell-only PWA foundation is complete.**
6. Security review, cross-app compatibility tests, and accessibility testing.
