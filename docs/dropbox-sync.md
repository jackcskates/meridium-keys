# Dropbox Synchronization

## Source of the pattern

The existing Signal Music project at `/Users/jskates/Github/signal-player` is a
read-only reference. Its useful patterns are separation of authentication and
sync, App Folder access, least permissions, a local-first cache, revision-aware
writes, queued retry, progressive status, and clear error messages.

Meridium Keys will reimplement these ideas for the web. It will not copy Signal
Music credentials, Swift-specific code, or media-library behavior.

## Authentication

**Implemented:**

- The scoped Dropbox application uses App Folder access. Its physical account
  folder is `/Apps/Meridium Keys`; API paths are relative to that root.
- Authorization uses code flow with PKCE S256 and no app secret.
- The production redirect is `https://keys.meridium.app/`; the local redirect is
  `http://127.0.0.1:5175/`.
- Authorization requests offline access. Short-lived access tokens remain
  memory-only; the returned refresh token is AES-GCM encrypted before it is
  stored in IndexedDB. On launch or reload, the client decrypts it locally,
  requests a new access token, and reloads the vault library automatically.
- Sign out removes the encrypted refresh credential. A failed refresh returns
  the UI to an explicit reconnect state rather than pretending it is connected.
- The client recursively lists metadata, filters standard `.kdbx` files, and
  downloads a selected encrypted file directly into the local unlock worker.
- Newly created standard KDBX files upload directly to the App Folder. Creation
  uses Dropbox add mode, disables automatic renaming, and treats an existing
  filename as a visible conflict rather than overwriting it.
- The upload route returns direct file metadata rather than a list-folder entry.
  The client accepts that shape and, if required fields are unexpectedly absent,
  refreshes the App Folder once to reconcile the file that Dropbox already saved.
- Current scopes are `account_info.read`, `files.metadata.read`,
  `files.content.read`, and `files.content.write`. Content write is used for new
  vault creation, revision-safe encrypted entry updates, and confirmed vault
  deletion.
- Entry and folder saves use Dropbox update mode with the revision that was
  opened. A newer remote revision stops the upload instead of being overwritten.
- Vault deletion names the vault, requires confirmation, does not require the
  KDBX master password, and sends the listed revision as a delete precondition.

**Current limitation:** the non-extractable wrapping key and encrypted refresh
token are stored in the same browser origin. This protects the token from casual
at-rest inspection, but same-origin script running in a compromised session could
still use the key. The next security slice derives the envelope from App Lock.

## Remote layout

**Carried-forward proposal:**

```text
Apps/Meridium Keys/
  vaults/
    <vault-id>.kdbx
  recovery/
    <vault-id>.recovery
  metadata/
    vaults.json
```

The final layout depends on whether standard KDBX compatibility and the separate
recovery-record design are approved. `vaults.json` must not contain item names,
usernames, URLs, tags, or other decrypted vault content.

An optional vault icon key may be stored in `vaults.json`, keyed by stable
Dropbox file ID. It is presentation metadata, contains no vault content, and
allows the icon to render before decryption. The encrypted KDBX root group can
also carry a standard or custom icon, but it is only readable after unlock.

## Local storage

IndexedDB may contain:

- Encrypted vault bytes.
- An AES-GCM-encrypted Dropbox refresh token and its non-extractable device-local
  wrapping key until the App Lock envelope replaces that interim boundary.
- Dropbox file ID, path, revision, size, and modification time.
- A local dirty flag and pending operation metadata.
- Non-sensitive display preferences.

It must not contain plaintext entries, derived keys, recovery phrases, or a
persistent search index of decrypted values.

## Sync flow

1. Authenticate or restore an allowed Dropbox session.
2. List encrypted vault files and revisions.
3. Compare remote revision with cached metadata.
4. Download changed encrypted bytes without decrypting in the sync layer.
5. Unlock only after the user selects a vault and provides its credential.
6. On entry or folder save, serialize and encrypt in the crypto layer first.
7. Write encrypted bytes locally as a pending revision.
8. Upload using the last known Dropbox revision as a precondition. The worker
   keeps the change provisional until Dropbox confirms the encrypted upload.
9. Mark the local copy clean only after Dropbox confirms the new revision.

## Conflict policy

**Proposed:** Never silently overwrite a newer remote vault.

- If only remote changed, download the new encrypted version.
- If only local changed, upload with the expected remote revision.
- If both changed, preserve both encrypted versions and require a safe merge or
  explicit user decision.
- Use KDBX merge only after its behavior is proven with fixtures, deletions,
  protected fields, custom types, and recovery metadata.

## User-visible states

- Dropbox not connected.
- Connected and current.
- Checking for changes.
- Downloading encrypted vault.
- Saving locally.
- Uploading encrypted vault.
- Offline with a cached vault.
- Permission update required.
- Authorization expired.
- Remote conflict detected.
- Dropbox temporarily unavailable.
- Last sync failed; encrypted local work retained.

Messages should say what happened, whether data is safe, and the next available
action without exposing technical details or secrets.
