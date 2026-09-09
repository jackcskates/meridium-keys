# Meridium Keys

Meridium Keys is a local-first password vault PWA. It is being built with
Vite, React, and TypeScript, with Dropbox used to synchronize encrypted vault
files.

## Current state

The application foundation is installed and the production build passes. The
generated starter screen is temporary; product UX work begins after the short
requirements interview is complete.

## Development

Requirements: Node.js 22.12 or newer.

```bash
npm install
npm run dev
```

Other checks:

```bash
npm run build
npm run lint
```

## Product guardrails

- Vault contents are decrypted only on the user's device.
- Dropbox stores and transports encrypted vault files, never plaintext items.
- No Dropbox app secret, master password, recovery phrase, or decrypted field
  may be committed, logged, or placed in a Vite environment variable.
- Offline storage may contain application assets, encrypted vault bytes, and
  non-sensitive sync metadata only.
- Each vault has independent credentials and lock state.
- Compatibility and recovery decisions are documented in
  `docs/architecture-foundation.md`.

See the [documentation index](docs/README.md) for the living product brief,
feature catalog, security model, Dropbox plan, UX principles, and decision log.

## Design reference

The UX and UI architecture follows the supplied Meridium design reference:
clarity before novelty, one obvious primary action per state, predictable
navigation, visible field labels, readable typography, consistent tokens and
components, accessible contrast, and explicit destructive confirmations.
