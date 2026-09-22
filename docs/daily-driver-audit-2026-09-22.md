# Daily-driver audit — 2026-09-22

This is a focused reliability sweep, not an independent security certification.
No personal vault or live Dropbox data was changed during this audit.

## Fixed and verified

- **PWA update:** A waiting service worker is explicitly activated and the app
  reloads after activation. Update errors are visible. If vaults are open, an
  explicit confirmation locks them first and warns that unsaved forms will be
  discarded. A two-build production-preview test observed the old build's
  Update prompt and the new build ID after clicking Update.
- **Dropbox write status:** Successful create, save, rename, and delete actions
  update local library metadata directly. A later list-folder outage cannot
  misreport a confirmed encrypted write as failed. Old library requests cannot
  overwrite newer revisions or restore a session after sign-out.
- **Dropbox resume:** Operations refresh an expiring access token just before a
  request, covering a device whose timers were suspended while asleep.
- **Credential lifecycle:** Encrypted refresh-token writes, reads, and deletion
  are serialized so a pending save cannot finish after sign-out deletion.
- **Vault save recovery:** If Dropbox confirms a write but the local worker
  cannot commit, the worker closes and Keys requires a fresh vault open. It
  does not claim that the remote write was rolled back.
- **Vault isolation:** Switching between two open vaults remounts the entry
  workspace, clearing old drafts, revealed values, selection, and folder state.
  A newly selected local file also receives a separate workspace identity.
- **Worker failure:** A timed-out vault operation terminates its worker rather
  than leaving an uncertain decrypted session alive.
- **Loading and motion:** Dropbox vault rows, connection restoration, and entry
  detail loading use layout-matched placeholders. The shimmer and interaction
  transitions follow the Meridium reference timing; reduced-motion preferences
  disable decorative animation.

## Evidence

- Production build and TypeScript compilation passed.
- Lint passed without warnings.
- 83 automated tests passed, including KDBX compatibility, Dropbox revision
  conditions, PWA update activation, save recovery, vault isolation identity,
  credential write ordering, and worker lock/timeout lifecycle.
- PWA manifest/service-worker/icon verification passed.
- Full `npm audit --audit-level=moderate` found zero reported vulnerabilities.
- Isolated production-preview browser test: build `local-202609221907` displayed
  Update ready; clicking Update reloaded into test build `1234567`.
- The isolated app-lock setup rendered without browser console warnings/errors.

## Not yet validated or safe to claim

- No physical iPhone PWA test was possible in this audit. Browser resizing is
  not a substitute for iOS process eviction, storage behavior, or Home Screen
  update testing.
- No live Dropbox write test was run against the owner's password vaults. Tests
  use fixture KDBX files and mocked Dropbox responses; live end-to-end create,
  edit, delete, restore, and conflict flows still need a disposable vault.
- Dropbox vaults are not cached for offline reopening. If the PWA is terminated
  while offline, an encrypted vault may be unavailable until Dropbox returns.
- Concurrent clients stop on a stale Dropbox revision; Keys does not yet merge
  two independently edited vault versions or preserve a conflicted edit as a
  durable encrypted local draft.
- Master-password recovery is not implemented. A forgotten vault password
  cannot be recovered through Keys.
- The temporary app gate and same-origin Dropbox token wrapping are not a
  complete authentication/security boundary. Formal threat modeling, CSP,
  independent security review, and physical-device testing remain necessary.

Until those gaps are addressed, keep a separately verified encrypted KDBX
backup and the existing password manager during migration. Test any new vault
in KeePassXC or another independent KDBX reader before relying on it alone.
