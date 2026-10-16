---
---

Migrate `@valdres/browser-window` and `@valdres/browser-screen` from the
removed `globalAtom` constructor to the public `externalAtom` primitive.

Intentionally empty: both packages are still release-ignored in
`.changeset/config.json`, so this change publishes nothing. Release enablement
is a separate change, and its changeset must carry the breaking changes:

- `windowSizeAtom` and `screenAtom` are read-only `ExternalAtom`s; `set`,
  `reset`, `update`, `setSelf` and `resetSelf` are gone.
- Listeners attach per store tree instead of once per process; reads without a
  subscription sample the platform live.
- Snapshots are frozen and shared between stores, reused while unchanged, and
  typed `readonly`.
- `ScreenInfo.orientationType` is the package's own `ScreenOrientationType`
  instead of the DOM library's `OrientationType` (the same four strings).
- `@valdres/browser-screen` also listens for Chromium's `screen` `change`, and
  drops the Safari 13 `MediaQueryList.addListener` fallback.
- The `valdres` peer range is `^1.0.0-beta.39`, the first core with
  `externalAtom`.
