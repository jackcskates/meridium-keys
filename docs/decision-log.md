# Decision Log

Update this file when a decision changes. Do not rewrite prior decisions as if
they never existed; mark them superseded and link to the replacement.

## Accepted

### D-000 - Local and platform-independent development

- **Status:** Accepted
- **Decision:** Develop and preview Meridium Keys locally with the standard Vite
  development server. Do not use OpenAI Sites or add OpenAI hosting,
  configuration, packages, runtime dependencies, or platform integrations.
- **Reason:** The application must remain portable and independent of any
  proprietary application platform. A hosting provider may be considered only
  when the user explicitly requests one.

### D-001 - Client foundation

- **Status:** Accepted
- **Decision:** Use Vite, React, and TypeScript for the PWA foundation.
- **Reason:** The product is interaction-heavy, local-first, and browser-based;
  this stack provides a small client foundation with strong TypeScript and PWA
  tooling support.

### D-002 - Local-first trust boundary

- **Status:** Accepted
- **Decision:** Decrypt and encrypt vaults on the user's device. Persist and sync
  only encrypted vault bytes plus non-sensitive metadata.
- **Reason:** Dropbox and browser persistence must not require access to readable
  credentials.

### D-003 - Dropbox reference implementation

- **Status:** Accepted
- **Decision:** Reuse the architectural patterns learned from Signal Music while
  creating a browser-specific implementation for Meridium Keys.
- **Reason:** Signal Music already validates useful App Folder, local-first,
  revision, retry, and error-state patterns.

### D-004 - Design reference

- **Status:** Accepted
- **Decision:** Apply the supplied Meridium design material to UX architecture,
  tokens, components, copy, accessibility, and validation.
- **Reason:** It establishes clarity, hierarchy, consistency, and user-centered
  design as project standards.

### D-015 - Initial Dropbox session

- **Status:** Accepted for the read-only compatibility slice
- **Decision:** Use authorization-code OAuth with PKCE and a short-lived,
  memory-only Dropbox access token. Do not request or persist a refresh token yet.
- **Reason:** This enables real App Folder discovery and encrypted KDBX download
  without storing a bearer credential before App Lock encryption exists.
- **Replacement condition:** Once App Lock is implemented and reviewed, replace
  session-only authorization with an encrypted refresh-token envelope.

### D-016 - PWA cache boundary

- **Status:** Accepted
- **Decision:** Install Meridium Keys as a standard standalone PWA while caching
  only its versioned application-shell assets. Do not runtime-cache Dropbox API
  responses, tokens, KDBX files, or decrypted vault data in the service worker.
- **Reason:** The interface can start offline without creating an unprotected
  second copy of security-sensitive data. Encrypted offline vault retention must
  wait for the per-device App Lock envelope.

### D-017 - Keys accent and collapsed rail behavior

- **Status:** Accepted
- **Decision:** Use `#4de89a` for the Meridium Keys mark and restrained accent
  cues. It matches the former coral's HSV saturation and brightness at a green
  hue. In the collapsed rail, clicking the centered Meridium mark expands the
  navigation; no separate expand arrow is shown.
- **Reason:** Owner-approved product variation and a cleaner, consistently
  aligned compact navigation rail.

### D-018 - Temporary client-side App Lock

- **Status:** Accepted as temporary
- **Decision:** Require an app password once per PWA session using a salted,
  slow PBKDF2 verifier. Never commit the plaintext password. Explicit App Lock
  clears the session flag and unmounts the active workspace.
- **Reason:** Provide an immediate casual-access gate without introducing a
  Meridium account or proprietary runtime.
- **Limitation:** Static client verification is bypassable and supports offline
  guessing. Replace it with the reviewed encrypted App Lock envelope; use
  server-side access control separately if the deployment itself must be private.

## Open

### D-005 - Standard KDBX compatibility

- **Status:** Accepted
- **Decision:** Every vault remains a standard `.kdbx` file that can be opened
  in compatible third-party KeePass applications.
- **Reason:** Preserve user ownership, portability, and interoperability.
- **Impact:** Determines the storage model, schema mapping, Argon2 integration,
  test fixtures, merge behavior, and recovery architecture.

### D-006 - Twelve-word recovery design

- **Status:** Open
- **Question:** What does the recovery phrase unlock, where is the recovery
  record stored, and what happens after recovery?
- **Recommendation:** Keep recovery separate from the standard KDBX file and use
  a per-vault encrypted recovery record.
- **Constraint:** Recovery must not change the standard KDBX file or prevent it
  from opening with its master password in another application.

### D-013 - No Meridium account login

- **Status:** Accepted
- **Decision:** Meridium Keys has no application account or login. The entry
  flow connects Dropbox, creates a vault, or opens an existing KDBX vault.
- **Reason:** Vault credentials provide the security boundary; an additional app
  account would add friction without protecting locally decrypted content.

### D-014 - Responsive application shape

- **Status:** Accepted
- **Decision:** On desktop, the PWA is optimized for a compact application
  window. On phones, the installed PWA fills the available screen and adapts its
  navigation and layout for touch.

### D-007 - Version-one device and browser baseline

- **Status:** Open
- **Question:** Which desktop and mobile operating systems and browsers must be
  supported in the first release?
- **Impact:** PWA installation, secure storage behavior, clipboard clearing,
  WebAssembly performance, and testing scope.

### D-008 - Lock and clipboard policy

- **Status:** Open
- **Question:** When should an unlocked vault lock automatically, and how long
  should a copied secret remain on the clipboard?

### D-009 - Initial type schema

- **Status:** Open
- **Question:** Which exact fields are required for Login, Password, and API Key?
- **Impact:** UX forms, KDBX mapping, search, imports, and compatibility.

### D-010 - Dropbox token persistence

- **Status:** Open
- **Question:** Should the browser retain Dropbox authorization across sessions,
  and under what protection and revocation rules?
- **Impact:** Convenience, background synchronization, and the attack surface of
  a compromised browser profile.

## Later

### D-011 - Shared vaults

- **Status:** Later / validate
- **Question:** Should future vault sharing support view and edit roles?
- **Note:** Not part of the initial implementation until reconfirmed.

### D-012 - Migration target

- **Status:** Later / validate
- **Question:** Must version one import and fully replace the owner's 1Password 7
  workflow?
