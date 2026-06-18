# valdres-react

## 1.0.0-beta.2

### Patch Changes

- [#197](https://github.com/eigilsagafos/valdres/pull/197)
  [`4d57212`](https://github.com/eigilsagafos/valdres/commit/4d572129587e801ebea26c00f1e8f581b78f5035)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Make
  `store.get(selector)` return a stable reference across repeated reads of a
  derived selector that has no live consumer (not subscribed, no live
  dependents). Previously the first read of such a selector returned a different
  reference than subsequent reads, even when nothing had changed — values were
  always correct, only reference identity was unstable while unsubscribed. This
  is what tripped React's "The result of getSnapshot should be cached to avoid
  an infinite loop" warning at initial mount, before `useSyncExternalStore`
  establishes its subscription.

    Root cause: a read that materializes new atoms runs an init-only propagation
    to register them. That pass walks the just-read selector's dependents and,
    for any selector with no live consumer, drops its freshly-computed cache
    "for lazy re-eval" — so the very next read re-evaluated and produced a new
    reference. The read path (`getDefault`) now restores the read selector's
    freshly-computed value after that pass, so repeated unsubscribed reads are
    reference-stable.

    The restore applies only to the selector being read. A selector reached
    merely transitively — e.g. one that read a family whose membership the read
    just changed — is still invalidated, so genuine staleness is picked up on
    its next read. A side benefit: a selector read without a subscription is now
    computed exactly once instead of twice (the init-time double-evaluation is
    gone).

- Updated dependencies
  [[`67536e7`](https://github.com/eigilsagafos/valdres/commit/67536e7f177d46278b7324a56b2eecf738b1c86f),
  [`0b3dbb7`](https://github.com/eigilsagafos/valdres/commit/0b3dbb7214d640beac5c1aead9d89e45d732e4fd),
  [`ce638b0`](https://github.com/eigilsagafos/valdres/commit/ce638b0ba3871b2ba1536589da482670822c3585),
  [`a0c959a`](https://github.com/eigilsagafos/valdres/commit/a0c959a1d41bc7041a69c87c651a6e7f5587d9ca),
  [`4d57212`](https://github.com/eigilsagafos/valdres/commit/4d572129587e801ebea26c00f1e8f581b78f5035),
  [`59fab53`](https://github.com/eigilsagafos/valdres/commit/59fab53ed00b411ca3ad331f92f49c1c34fb7ae2)]:
    - valdres@1.0.0-beta.9

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
    - valdres@1.0.0-beta.1
