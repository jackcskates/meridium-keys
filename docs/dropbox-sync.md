# Dropbox Synchronization

## Source of the pattern

The existing Signal Music project at `/Users/jskates/Github/signal-player` is a
read-only reference. Its useful patterns are separation of authentication and
sync, App Folder access, least permissions, a local-first cache, revision-aware
writes, queued retry, progressive status, and clear error messages.

Meridium Keys will reimplement these ideas for the web. It will not copy Signal
Music credentials, Swift-specific code, or media-library behavior.

## Authentication

**Proposed:**

- Register a separate Dropbox application for Meridium Keys.
- Prefer App Folder access.
- Use authorization code + PKCE in the browser.
- Include the public app key in configuration; never ship an app secret.
- Request only the scopes required to list, download, and upload files in the
  application folder.
- Treat account change or disconnect as an explicit security event.

Token persistence and refresh behavior require a focused threat-model decision.
A PWA cannot keep a browser-held refresh token as safely as a server-held
credential.

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

## Local storage

IndexedDB may contain:

- Encrypted vault bytes.
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
6. On save, serialize and encrypt in the crypto layer first.
7. Write encrypted bytes locally as a pending revision.
8. Upload using the last known Dropbox revision as a precondition.
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
