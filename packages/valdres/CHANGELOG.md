# valdres

## 1.0.0-beta.3

### Patch Changes

- [#131](https://github.com/eigilsagafos/valdres/pull/131)
  [`36f7524`](https://github.com/eigilsagafos/valdres/commit/36f75240f8fed2d0441fd30f360ed2dec24fafe1)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Defer
  `AbortController` allocation on the first evaluation of a selector until the
  selector body actually reads `options.signal`. `options.signal` is now a lazy
  getter, so selectors that don't use the signal (the common case) pay no
  allocation cost on their first eval. The known-sync cache still short-circuits
  subsequent evaluations to a shared options object. Aborting a previous
  controller on re-eval and storing the new controller for async re-eval
  cancellation are preserved.

## 1.0.0-beta.2

### Patch Changes

- [#128](https://github.com/eigilsagafos/valdres/pull/128)
  [`6c3a33b`](https://github.com/eigilsagafos/valdres/commit/6c3a33be48a8024907bd995ff6162fd4c00f1f28)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Fix spurious
  `SelectorCircularDependencyError` for selectors with no real cycle.
  `evaluateSelector` now runs its cleanup in a `finally` so the module-level
  `sharedCircularDepSet` is always cleared on exit — including when an inner
  selector throws a non-cycle error and the outer's `catch` re-raises a
  `SelectorEvaluationError`. Previously the entry leaked, and the next read of
  the outer selector tripped the cycle check on a stale entry.

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
