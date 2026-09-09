# Security and Recovery

Status: working security model. A formal threat model and independent review are
required before production use.

## Trust model

- The user's device performs vault decryption and encryption.
- Dropbox is trusted to transport and retain bytes, but not to see vault
  contents.
- Browser storage is treated as untrusted persistent storage.
- Application memory may contain decrypted values only while a vault is
  unlocked.
- The network must never receive plaintext vault contents or master credentials.

## Sensitive material lifecycle

### Master password

- Entered only into the unlock flow for one vault.
- Passed to the cryptographic worker without logging or serialization.
- Removed from form state immediately after use.
- Never stored for automatic unlock until a separate reviewed design exists.

### Decrypted vault model

- Exists only in memory while unlocked.
- Is scoped to one vault.
- Is destroyed on explicit lock and automatic-lock events.
- Must not be serialized by debugging tools, state-persistence middleware, or
  analytics.

### Clipboard

- Copy is an explicit user action.
- Clipboard-clearing behavior is still open because browser support and user
  expectations differ.
- The UI must state what it can and cannot clear reliably.

## Twelve-word recovery

**Confirmed intent:** Every vault has a 12-word recovery key that can restore
access if its master password is lost.

**Open design:** How the phrase accomplishes recovery without weakening vault
encryption or breaking third-party compatibility.

**Recommended direction:**

- Keep the `.kdbx` file standard and independently openable.
- Generate a high-entropy recovery secret represented by 12 validated words.
- Use that secret to unlock a separate encrypted recovery record containing the
  material required to regain vault access.
- Bind the recovery record to one vault identifier and version.
- Store no plaintext master password or recovery secret.
- Require the phrase to be confirmed during setup and provide a printable or
  offline recording flow.

This is a design hypothesis, not an approved implementation. Before building
it, define the attacker model, entropy and word-list standard, record format,
key-rotation behavior, deletion behavior, and what happens after recovery.

## Automatic lock events to decide

- User-selected inactivity timeout.
- Browser tab hidden or backgrounded.
- Device sleep or screen lock when detectable.
- Browser refresh, close, crash, or application update.
- Dropbox disconnect or account change.
- Switching between vaults.

## Required security tests

- KDBX read/write compatibility fixtures.
- Wrong-password and corrupted-file behavior.
- Recovery phrase validation and brute-force cost.
- Memory and persistence inspection after locking.
- No secrets in logs, errors, source maps, URLs, caches, or IndexedDB.
- Clipboard and reveal timeout behavior.
- Dropbox stale-revision and simultaneous-edit conflicts.
- Offline edits followed by reconnect.
- Service-worker update during an unlocked session.
- Content Security Policy and dependency supply-chain review.

## Current read-only verification

- Automated KDBX 4 Argon2id and AES-KDF fixtures open successfully.
- Protected password text is not included in the UI snapshot.
- Wrong passwords and malformed bytes return safe, non-library error messages.
- An independently generated PyKeePass KDBX 4 fixture opens in the browser worker.
- Explicit lock removes the decrypted snapshot and rendered entry metadata.
- Dependency audit currently reports no known vulnerabilities.

This verifies the current read-only slice only; it is not a complete security
assessment of editing, persistence, Dropbox synchronization, recovery, or production use.

## Non-goals for the first implementation

- Claiming that JavaScript memory can be wiped with the same guarantees as a
  purpose-built native secure enclave.
- Inventing new cryptographic primitives.
- Storing a production Dropbox token or secret in the repository.
- Treating obfuscation as encryption.
