---
---

Migrate the five browser media-preference packages — `@valdres/browser-color-scheme`,
`@valdres/browser-contrast`, `@valdres/browser-reduced-motion`,
`@valdres/browser-reduced-data` and `@valdres/browser-reduced-transparency` — from the
removed `globalAtom` constructor to the public `externalAtom` primitive.

Intentionally empty: all five packages are release-ignored in `.changeset/config.json`
while the core + React v1 beta ships, so this lane publishes nothing. Integration owns
their release eligibility.
