# Security and Recovery

Status: working security model. A formal threat model and independent review are
required before production use.

## Trust model

### Temporary application lock

The current PWA requires an app password once per browser/PWA session. Source
contains only a salted PBKDF2-SHA-256 verifier; the plaintext password is not
committed. Successful unlock is remembered in `sessionStorage`, and explicit
App Lock removes that flag and unmounts the Dropbox/vault workspace so its
memory-only session data is released.

The App Lock field disables mobile capitalization, autocorrection, and spelling
changes. Accidental leading or trailing whitespace from paste is ignored for
this temporary app credential. Vault master passwords remain byte-exact and are
not trimmed or normalized.

This is a temporary casual-access gate, not server authentication. Because the
entire static client is delivered to the device, a determined person can alter
the client or perform an offline guessing attack against its verifier. The
approved replacement is the per-device App Lock envelope, where a derived key
encrypts persisted Dropbox authorization and cached KDBX bytes.

- The user's device performs vault decryption and encryption.
- Dropbox is trusted to transport and retain bytes, but not to see vault
  contents.
- Browser storage is treated as untrusted persistent storage.
- Application memory may contain decrypted values only while a vault is
  unlocked.
- The network must never receive plaintext vault contents or master credentials.

## Sensitive material lifecycle

### Master password

- Entered only into the create or unlock flow for one vault.
- iOS capitalization, correction, spelling, and site-password autofill are
  disabled because a KDBX password is not the app's website credential.
- A failed unlock leaves the value only in the visible form long enough for the
  user to inspect or correct it; successful unlock clears the form.
- Passed to the cryptographic worker without logging or serialization.
- Cleared after successful unlock or when the unlock view is left.
- Never stored for automatic unlock until a separate reviewed design exists.
- New vault creation currently requires 15–128 Unicode characters, rejects a
  small local set of common examples and repeated single-character values,
  requires a value different from the vault name, and requires confirmation.
- Long passphrases are accepted without arbitrary uppercase, number, or symbol
  rules. The live checklist is guidance and local validation, not a claim that
  the password has been checked against a maintained breach corpus.

### New vault encryption

- New files use standard KDBX 4 serialization through `kdbxweb`.
- The key derivation function is Argon2id with 64 MiB memory, three iterations,
  and one lane for the initial compatibility slice.
- Encryption completes locally before encrypted bytes are sent to Dropbox.
- These parameters require performance validation on the supported phone baseline
  and may be strengthened through a versioned policy without changing the KDBX format.

### Decrypted vault model

- Exists only in memory while unlocked.
- Is scoped to one vault.
- Is destroyed on explicit lock and automatic-lock events.
- Must not be serialized by debugging tools, state-persistence middleware, or
  analytics.
- Protected entry values remain inside the worker until the user opens an entry
  editor or explicitly copies one masked field. Copy returns only that requested
  field to the click handler; the plaintext is never placed in React state. The
  editor holds the active draft in volatile React memory only and clears it on
  save, cancel, lock, or unmount.
- Moving an entry sends only its opaque KDBX entry and destination group IDs to
  the worker. The worker changes the standard KDBX parent relationship and
  re-encrypts the database without exposing protected fields to the React view.
- Generated service passwords use `crypto.getRandomValues`, guarantee all four
  required character classes, and remain only in the active editor draft until
  the normal worker encryption and revision-safe Dropbox save completes.
- Entry changes are encrypted into a provisional KDBX revision in the worker.
  The worker commits that revision only after Dropbox accepts the expected
  remote revision; failed or conflicting uploads discard the provisional model.

### Dropbox authorization

- OAuth uses authorization code with PKCE and no client secret.
- Access tokens are short-lived and memory-only.
- The refresh token is AES-GCM encrypted before IndexedDB storage. The stored
  CryptoKey is non-extractable, and signing out removes the encrypted credential.
- This interim design protects the plaintext token at rest, but the wrapping key
  is available to the same browser origin. It does not protect against XSS, a
  compromised browser profile, or malicious code already running as the app.
- The planned App Lock envelope must replace the device-local wrapping key so
  reconnect is cryptographically bound to the user's app unlock secret.

### Clipboard

- Copy is an explicit user action.
- The selected-entry view keeps protected values masked and identifies each
  populated field by label. Each Copy control requests only its corresponding
  field from the worker.
- Apple clients prefer promise-backed `ClipboardItem` data so an installed
  Safari PWA can preserve the original tap's clipboard authorization across the
  worker round trip. Other clients use the text clipboard API directly; it is
  also the Apple fallback when promise-backed data is rejected.
- Copied plaintext is not stored in React state, logs, notifications, URLs, or
  persistent browser storage.
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

## Current compatibility verification

- Automated KDBX 4 Argon2id and AES-KDF fixtures open successfully.
- Protected password text is not included in the UI snapshot.
- Wrong passwords and malformed bytes return safe, non-library error messages.
- An independently generated PyKeePass KDBX 4 fixture opens in the browser worker.
- Explicit lock removes the decrypted snapshot and rendered entry metadata.
- A newly created standard KDBX 4 vault reopens with its chosen password and
  rejects a wrong password in automated tests.
- All ten typed entry schemas reopen through the standard KDBX parser with
  protected fields intact. Created and renamed folders persist; folder deletion
  is rejected until both its entry and child-folder collections are empty.
- Dependency audit currently reports no known vulnerabilities.

This verifies creation and the initial revision-safe entry-write slice; it is not
a complete security assessment of persistent authorization, offline editing,
multi-client merge, recovery, or production use.

## Non-goals for the first implementation

- Claiming that JavaScript memory can be wiped with the same guarantees as a
  purpose-built native secure enclave.
- Inventing new cryptographic primitives.
- Storing a production Dropbox token or secret in the repository.
- Treating obfuscation as encryption.
