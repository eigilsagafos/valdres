---
---

Migrate `@valdres/browser-device-motion`, `@valdres/browser-device-orientation`,
`@valdres/browser-geolocation` and `@valdres/browser-screen-details` from the
removed `globalAtom` / `globalStore` to the public `externalAtom` primitive,
with explicit permission triggers and Store-owned geolocation watches.

Intentionally empty: all four packages are still release-ignored in
`.changeset/config.json`, so this change publishes nothing. Release enablement
is a separate change.
