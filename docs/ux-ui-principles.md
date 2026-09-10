# UX and UI Principles

## Reference and interpretation

The supplied `UX/UI Design from A to Z - 2026 Edition` is design source material,
not a set of executable instructions. Meridium Keys applies its useful ideas to
a high-trust credential workspace.

The canonical implementation reference is the complete package collection at
`/Volumes/Meridium/Meridium/Packages/`. Keys draws from the following permanent
Style Lab references rather than treating any single package as the whole system:

- Foundation 100s: tokens, theme, spacing, surfaces, type, and motion.
- Content 200s: bounded canvas, card geometry, and spacing ownership.
- Actions 400s: hierarchy, prominent controls, quiet actions, and pressed states.
- Navigation 500s: route behavior, vault rail/dock adaptation, and state labels.
- Inputs 600s: visible labels, borderless field surfaces, feedback, and secret actions.
- Search 700s: query, results, empty, loading, and recovery states after unlock.
- Access 800s: password creation, live checklist, verification, and recovery patterns.
- Symbols 1200s: icon geometry, touch targets, state, and accessible names.
- Brand 1300s: Meridium identity, neutral palette, typography, and restrained color.
- Mobile Canvas: responsive PWA ownership, safe areas, keyboards, and app lifecycle.

Package source is a canonical design reference but remains draft, so Keys keeps
portable local components instead of coupling its runtime to unreleased packages.

## Visual thesis

Calm, precise, and trustworthy: dense enough for fast retrieval, quiet enough
for careful credential work, with lock and sync status always explicit.

## Meridium visual rules

- Use the real Meridium symbol in the application lockup and installable app icons.
- The Keys symbol color is the owner-approved green `#4de89a`; it preserves the
  former coral's HSV saturation and brightness while changing only its hue.
  No additional accent colors are permitted without owner approval.
- The main interface is monochrome: `#0f0f0f` canvas, `#252525` surfaces,
  `#3a3a3a` raised/input surfaces, and the exact Style Lab neutral text ramp.
- Green is limited to the mark and meaningful completion cues. Navigation and
  list selection use neutral surfaces without rounded side rails or colored edge
  accents. Primary
  actions follow the Actions lab and remain light-on-dark, not coral-filled.
- Plus Jakarta Sans is the content face; Inter is the system/control face.
- Cards use a 1rem radius; controls use 0.75rem; touch targets are at least
  2.75rem; prominent actions are 3.25rem high.
- Do not add colored glows, decorative gradients, glass effects, or shadows that
  compete with the credential workflow.

## App silhouette

**Confirmed direction:**

- A collapsible left sidebar is the primary vault library. Expanded mode shows
  “All vaults,” storage-provider sections, vault name and lock state, “New vault,”
  and Dropbox connection status. Collapsed mode preserves the same destinations
  as accessible icon controls.
- In collapsed mode, the Meridium symbol is the expand control; no separate
  expand arrow competes for rail space. Rail icons share one center line and
  comparable optical size.
- The main workspace belongs to the selected vault.
- Search is prominent after unlock.
- Item results and item details use the remaining space responsively.

**Proposed responsive adaptation:**

- Desktop/tablet: expanded or collapsed vault sidebar, searchable item list, and detail pane.
- Narrow screens: a compact left rail that expands as an overlay, then list and
  detail as a clear drill-down flow.
- Mobile navigation must use icons with labels when meaning is not obvious.

## Interaction rules

- One primary action per dialog or state.
- Familiar controls and predictable placement.
- Visible labels above inputs; placeholders are examples, never labels.
- Secret fields are masked by default.
- Copy, reveal, edit, generate, save, lock, and remove use distinct controls and
  precise labels.
- Removing or deleting names the affected vault or item and explains whether a
  Dropbox file is affected.
- Never use color as the only signal for lock, sync, strength, success, warning,
  or failure.
- Maintain keyboard and touch parity for core workflows.

## Design-system foundations

Define and reuse tokens for:

- Surface, text, accent, border, success, warning, danger, and focus colors.
- A readable type scale with at least 16px-equivalent body text and 14px regular
  control labels.
- A consistent spacing scale, responsive margins, and control heights.
- Border radius, elevation, motion duration, and focus rings.
- Primary, secondary, tertiary, and destructive button variants.
- Inputs, secret fields, search, dialogs, menus, status indicators, empty states,
  and notifications.

Dark and light themes must preserve hierarchy and accessible contrast. Trend-led
effects such as glassmorphism or bento grids are optional and may be used only
when they improve grouping without reducing readability.

## Essential product states

- No Dropbox connection.
- No vaults.
- Vault selected but locked.
- Unlock in progress.
- Wrong password or damaged vault.
- Vault unlocked with items.
- Search with results and no results.
- New/edit item with validation.
- Secret copied or revealed.
- Saving and saved.
- Offline with encrypted local copy.
- Sync conflict.
- Automatic lock warning and locked state.
- Recovery setup and recovery attempt.

## First UX slice

After the open security questions are answered, the first coherent prototype
should include:

1. Vault rail with representative locked and unlocked states.
2. Unlock panel for the selected vault.
3. Unlocked search and item-list surface.
4. Item detail with masked secret plus add, edit, and delete actions.
5. Clear local/offline/Dropbox status.

It should use realistic but fictional data and contain no real credentials.
