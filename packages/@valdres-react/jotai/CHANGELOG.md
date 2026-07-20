# @valdres-react/jotai

## 1.0.0-beta.2

### Patch Changes

- [#253](https://github.com/eigilsagafos/valdres/pull/253)
  [`01529e5`](https://github.com/eigilsagafos/valdres/commit/01529e523bbf26df6e3c188c052c44ef64303ec8)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Update Jotai
  compatibility coverage to Jotai 2.20.2. Preserve dependency read order when
  mounting sibling atoms, and surface original atom-read errors from the Jotai
  adapter instead of Valdres diagnostic wrappers. Support Jotai's per-store
  `INTERNAL_onInit` hook for primitive atoms.

- [#251](https://github.com/eigilsagafos/valdres/pull/251)
  [`d11de95`](https://github.com/eigilsagafos/valdres/commit/d11de95881d0548fbf47add4a942aecb8fef6b0c)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Make Store runtimes
  opaque. Stores now expose stable public identity through `store.id` instead of
  publishing mutable `StoreData`; `StoreData` is no longer exported from
  `valdres`, and `onSet` receives the public Store facade. Framework and tooling
  adapters now use the capability-based, versioned
  `valdres/adapter-internals/v1` boundary, which keeps adapter lookups off atom
  get/set hot paths. Engine-only atom/global-atom synchronization fields and the
  `MaxAgeInterval` timer type are no longer part of the public type surface.

- [#242](https://github.com/eigilsagafos/valdres/pull/242)
  [`165cdc4`](https://github.com/eigilsagafos/valdres/commit/165cdc4346091f860c193a686f4ea55e1e955671)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Make `store.txn`
  own its complete atomic lifecycle. Transaction callbacks now receive a
  restricted, type-only `Transaction` surface with no manual `commit()` or
  backing `data`; a thrown callback always discards staged writes. Captured
  operations reject use while the transaction is committing or after it closes.

    Move manually controlled transactions to the explicit
    `valdres/adapter-internals` boundary, and update the Jotai compatibility
    adapter to use that boundary while preserving its adapter-specific
    commit-on-error semantics.

- Updated dependencies
  [[`d11de95`](https://github.com/eigilsagafos/valdres/commit/d11de95881d0548fbf47add4a942aecb8fef6b0c)]:
    - valdres-react@1.0.0-beta.3

## 1.0.0-beta.1

### Patch Changes

- [#123](https://github.com/eigilsagafos/valdres/pull/123)
  [`ca1f266`](https://github.com/eigilsagafos/valdres/commit/ca1f266b1af0970161584da3cc0c1271a2c97ba2)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Fix `workspace:^`
  leaking into published manifests. The previous beta releases shipped with
  literal `"valdres": "workspace:^"` in their `dependencies`, which npm cannot
  resolve. Changesets only rewrites pinned workspace specs (e.g.
  `workspace:^1.2.3`), and `changeset publish` shells out to `npm publish` —
  which doesn't understand the workspace protocol — so the bare shortcut got
  published verbatim. Publishable packages now use plain semver ranges for
  inter-package deps; changesets keeps them in lockstep on every bump, and
  `verify-publish` fails CI if any `workspace:` reference sneaks back in.

    The six Lerna-era packages still on the `pre` dist-tag
    (`@valdres/color-mode`, `@valdres/hotkeys`, `@valdres-react/color-mode`,
    `@valdres-react/draggable`, `@valdres-react/hotkeys`,
    `@valdres-react/panable`) get a `minor` bump so they land on `0.3.0-beta.0`
    — a clean transition from the old `0.2.0-pre.28` line to the unified `beta`
    dist-tag.

- Updated dependencies
  [[`ca1f266`](https://github.com/eigilsagafos/valdres/commit/ca1f266b1af0970161584da3cc0c1271a2c97ba2)]:
    - valdres-react@1.0.0-beta.1
