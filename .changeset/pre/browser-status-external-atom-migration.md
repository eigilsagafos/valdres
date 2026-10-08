---
---

Migrate `@valdres/browser-online`, `@valdres/browser-focus`,
`@valdres/browser-visibility` and `@valdres/browser-presence` from the removed
`globalAtom` constructor to the public `externalAtom` primitive.

Intentionally empty: all four packages are still release-ignored in
`.changeset/config.json`, so this change publishes nothing. Release enablement is
a separate change.
