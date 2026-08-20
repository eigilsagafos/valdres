# @valdres-react/draggable

## 0.3.0-beta.1

### Patch Changes

- [#304](https://github.com/eigilsagafos/valdres/pull/304)
  [`2539b82`](https://github.com/eigilsagafos/valdres/commit/2539b82d95c7f1329f17a9a2740eef5bbb5be690)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Ship ESM
  declarations with explicit `.js` import specifiers so package exports resolve
  for Node16 and NodeNext TypeScript consumers with library checking enabled.

- [#305](https://github.com/eigilsagafos/valdres/pull/305)
  [`40a0998`](https://github.com/eigilsagafos/valdres/commit/40a0998a019653f3a94fd310b8a143879ecae5b7)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Fix published
  metadata for CommonJS `require(esm)` and legacy TypeScript resolution, declare
  Node.js 22.12 or newer, and preserve Valdres's runtime duplicate-instance
  guard during tree-shaking.
- Updated dependencies
  [[`2539b82`](https://github.com/eigilsagafos/valdres/commit/2539b82d95c7f1329f17a9a2740eef5bbb5be690),
  [`40a0998`](https://github.com/eigilsagafos/valdres/commit/40a0998a019653f3a94fd310b8a143879ecae5b7)]:
    - valdres-react@1.0.0-beta.4

## 0.3.0-beta.0

### Minor Changes

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

### Patch Changes

- Updated dependencies
  [[`ca1f266`](https://github.com/eigilsagafos/valdres/commit/ca1f266b1af0970161584da3cc0c1271a2c97ba2)]:
    - valdres-react@1.0.0-beta.1
