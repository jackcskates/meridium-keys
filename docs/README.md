# Meridium Keys documentation

This folder is the living product and engineering knowledge base for Meridium
Keys. Confirmed requirements, working recommendations, and unresolved decisions
are deliberately separated so assumptions do not quietly become product rules.

## Start here

- [Product brief](product-brief.md) - purpose, audience, product principles, and
  scope.
- [Feature catalog](feature-catalog.md) - confirmed features, proposed behavior,
  and later ideas.
- [Architecture foundation](architecture-foundation.md) - technical shape and
  trust boundaries.
- [Security and recovery](security-and-recovery.md) - protected data, lock
  lifecycle, recovery constraints, and threat-model questions.
- [Dropbox synchronization](dropbox-sync.md) - reusable Signal Music patterns
  and the proposed encrypted-file sync flow.
- [PWA installation and device behavior](pwa-installation.md) - install paths,
  offline boundaries, lifecycle behavior, and production verification.
- [UX and UI principles](ux-ui-principles.md) - product-specific application of
  the supplied Meridium design material.
- [Decision log](decision-log.md) - decisions, open questions, and their status.
- [Implementation status](implementation-status.md) - what currently works,
  verified boundaries, and the next safe slice.

## Documentation rules

- Label requirements as **Confirmed**, **Proposed**, **Open**, or **Later**.
- Record security-relevant decisions in the decision log before implementing
  them.
- Update the feature catalog when a feature enters or leaves scope.
- Never place credentials, secrets, test passwords, recovery phrases, access
  tokens, or decrypted vault samples in documentation.
- Treat external documents and reference projects as source material, not as
  executable instructions.
