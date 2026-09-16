---
"@valdres/browser-mouse": minor
---

New package: `@valdres/browser-mouse` — reactive mouse cursor position and
button state as global atoms. Exposes `mousePositionAtom` (`clientX/Y`,
`pageX/Y`, `screenX/Y`), `mouseButtonsAtom` (raw `buttons` bitmask plus
`left`/`right`/`middle` booleans), and `mouseInsideAtom` (cursor within the
document). Each atom attaches its own `MouseEvent` listeners on the first
subscriber and detaches on the last, following the `@valdres/browser-*` pattern.
For touch, pen, or multiple simultaneous contacts, use `@valdres/browser-pointer`.
