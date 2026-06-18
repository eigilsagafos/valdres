# valdres-svelte

## 1.0.0-beta.5

### Minor Changes

- [#193](https://github.com/eigilsagafos/valdres/pull/193)
  [`b21fbdc`](https://github.com/eigilsagafos/valdres/commit/b21fbdcd29af7ff6c36a470d8669e36d0fff91ee)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Full breaking 1.0
  rework of the Svelte 5 adapter — fixes the broken published artifact, adopts
  the 2026 Svelte idiom end to end, and adds the provider tier the other
  adapters already have.

    **Packaging (fixes a fundamentally broken npm artifact).** The package now
    ships uncompiled source via `@sveltejs/package` (`svelte-package`) with an
    exports map of `{ "types", "svelte", "default" }` and
    `"sideEffects": false`, the way every Svelte 5 library ships. Previously the
    build bundled runes into plain JS (`$state is not defined` in consumers) and
    `prepack` dropped the `svelte` export condition, so the package only worked
    inside the monorepo. The prepack exports rewrite is now special-cased to
    leave this package's dist-pointing conditions untouched, and CI runs
    `publint` + `svelte-check` against the packed tarball so it can't regress.
    The svelte peer dependency is bumped to `>=5.7` (for `createSubscriber`).

    **Renames (breaking).**

    - `watch` → `fromState`. `watch` collided with runed's `watch` (an
      effect-with-deps helper). `fromState` mirrors svelte/store's `fromStore`.
    - `readable` → `toStore`. `readable` shadowed svelte/store's `readable`;
      `toStore` mirrors svelte/store's own conversion verb.
    - `.value` → `.current`. The reactive box now exposes `.current` (the Svelte
      5 idiom shared by `fromStore`, Spring, Tween, MediaQuery, and all of
      runed) instead of `.value` (a Vue ref-ism).

    **`fromState` (breaking).** Returns
    `{ get current(), set current(v), update(fn), reset() }` for atoms and
    `{ readonly current }` for selectors, so `bind:value={box.current}` and
    `box.current++` work. Plain sets go through `box.current = v`; the
    read-modify-write updater is `box.update(c => c + 1)` (mirroring
    `svelte/store`'s `Writable.update`). The `current` setter wraps the value in
    a thunk so a function value is stored verbatim rather than treated as an
    updater. Async selectors are now typed honestly as `current: V | Promise<V>`
    — consume with `{#await box.current then v}` (core erases asyncness, so the
    union is the honest adapter-level type). Rebuilt on `createSubscriber` from
    `svelte/reactivity`: the underlying valdres subscription is now lazy and
    shared.

    **Behavior change — lazy bootstrap.** With lazy subscription, a valdres
    `onMount`-driven atom (the `@valdres/browser-*` pattern) only bootstraps
    once `.current` is read inside an effect — components that read the value
    solely in an event handler will see the unbootstrapped default. This matches
    Svelte's own `MediaQuery` semantics.

    **`toStore` (breaking).** An atom now yields a `Writable<V>` (`subscribe` /
    `set` / `update`, delegating to the store) so `$count$ = 5`,
    `count$.set(...)`, and `bind:value={$count$}` work; a selector stays a
    read-only `Readable<V>`. The `store` argument is now optional and defaults
    to the context store (`getValdresContext()`), consistent with every other
    primitive.

    **Provider tier (new).**

    - `setValdresContext(storeOrOptions?)` — the no-arg form auto-creates
      `store({ batchUpdates: true })` per component tree (= per SSR request, the
      canonical SvelteKit pattern); warns when handed a non-batched store; runs
      `initialize` inside a transaction (via core's shipped `InitializeCallback`
      / `setAtomPairs`); and applies a `hydrate` payload (core
      `dehydrate`/`hydrate`, which round-trips `BigInt`/`Date`/`Map`/`Set` over
      plain JSON for atoms with a codec schema — no custom serializer). When
      both are given, `initialize` runs first so hydrated/transferred values
      win.
    - `scope(scopeId?, { initialize })` — backward-compatible signature
      extension for per-scope seeding, parity with the other adapters.
    - `transaction(store?)` — returns a runner bound to the context store
      captured at component init, so it's safe to call from an event handler
      (Svelte throws `lifecycle_outside_component` for `getContext` outside
      init); forwards core's devtools `name`.
    - The Svelte context now lives under `Symbol.for("valdres")` (was the bare
      string `"valdres-store"`) and holds the cross-adapter
      `{ current, stores }` shape; `getValdresContext()` still returns the
      current `Store`.

    **`resourceState(sel, store?)` (new).** Returns
    `{ current: V | undefined, loading: boolean, error: unknown }` for a
    possibly async selector, doing the `isPromiseLike` detection and tracking
    promise settlement.

    **Type exports.** `FromStateAtom`, `FromStateValue`, `ResourceState`,
    `ScopeOptions`, `SetValdresContextOptions`, and `ValdresContext` are now
    exported.

### Patch Changes

- [#195](https://github.com/eigilsagafos/valdres/pull/195)
  [`67536e7`](https://github.com/eigilsagafos/valdres/commit/67536e7f177d46278b7324a56b2eecf738b1c86f)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Add
  `applyInitialize(txn, initialize)` — the single place the adapter `initialize`
  contract is interpreted, so every framework adapter handles it identically.

    It runs the callback inside a transaction the caller opened and applies any
    returned `[atom, value]` pairs, guarding with `Array.isArray` rather than a
    truthiness check. This fixes a latent footgun: a single-expression callback
    like `txn => txn.set(atom, 1)` already writes through `txn.set` and _returns
    that call's value_ (e.g. a number), which the previous
    `if (pairs) setAtomPairs(...)` pattern fed back into `setAtomPairs`,
    throwing "is not iterable". A non-array return now correctly means "the
    callback wrote directly; nothing left to apply".

    `valdres-svelte`'s `setValdresContext` and `scope` now consume the helper
    (replacing the inline `if (pairs)` pattern), so the crash no longer occurs.
    `setAtomPairs` remains exported as the low-level primitive; its docs now
    point to `applyInitialize` and show the `Array.isArray` guard.

- Updated dependencies
  [[`67536e7`](https://github.com/eigilsagafos/valdres/commit/67536e7f177d46278b7324a56b2eecf738b1c86f),
  [`0b3dbb7`](https://github.com/eigilsagafos/valdres/commit/0b3dbb7214d640beac5c1aead9d89e45d732e4fd),
  [`ce638b0`](https://github.com/eigilsagafos/valdres/commit/ce638b0ba3871b2ba1536589da482670822c3585),
  [`a0c959a`](https://github.com/eigilsagafos/valdres/commit/a0c959a1d41bc7041a69c87c651a6e7f5587d9ca),
  [`4d57212`](https://github.com/eigilsagafos/valdres/commit/4d572129587e801ebea26c00f1e8f581b78f5035),
  [`59fab53`](https://github.com/eigilsagafos/valdres/commit/59fab53ed00b411ca3ad331f92f49c1c34fb7ae2)]:
    - valdres@1.0.0-beta.9

## 1.0.0-beta.4

### Patch Changes

- Updated dependencies
  [[`affd12b`](https://github.com/eigilsagafos/valdres/commit/affd12b3845e355b71739cd7d577f5e2af5af74a),
  [`4ccd1af`](https://github.com/eigilsagafos/valdres/commit/4ccd1af8b24c69f725677222d99d055421352822),
  [`231e59d`](https://github.com/eigilsagafos/valdres/commit/231e59d15dabb8fd822e0803e93ffad0f0d0138a),
  [`b76cdc2`](https://github.com/eigilsagafos/valdres/commit/b76cdc27414abf4c55bb6dfbc9c1c5d370af8f1d),
  [`2776bff`](https://github.com/eigilsagafos/valdres/commit/2776bffa8deee3f2bc651c757aa19e788339fbfc),
  [`68b124d`](https://github.com/eigilsagafos/valdres/commit/68b124d4f191431cd608ff04ba5c5fb15429f205)]:
    - valdres@1.0.0-beta.7

## 1.0.0-beta.3

### Patch Changes

- Updated dependencies
  [[`fde2ec1`](https://github.com/eigilsagafos/valdres/commit/fde2ec1aa4da44a9f3fddddd5b7c7c03eeaba796),
  [`6fef9c9`](https://github.com/eigilsagafos/valdres/commit/6fef9c9fc8a8a481dbacce2768bc09e413f80bdf),
  [`f32eb3e`](https://github.com/eigilsagafos/valdres/commit/f32eb3ef0092e7756e89eb5b3944f091726401e4)]:
    - valdres@1.0.0-beta.5

## 1.0.0-beta.2

### Patch Changes

- Updated dependencies
  [[`f1afcc6`](https://github.com/eigilsagafos/valdres/commit/f1afcc6593854b86f9ae7387a8c00493f68a8ff7),
  [`73c2c8f`](https://github.com/eigilsagafos/valdres/commit/73c2c8f4528f1e8ddad331dd0017eeb7ca01c5ec),
  [`396a061`](https://github.com/eigilsagafos/valdres/commit/396a06183089ef4377a69f9580e30e025a1b7218),
  [`89838ee`](https://github.com/eigilsagafos/valdres/commit/89838eea5a65c161fb8d294d48257f3ba7602122),
  [`979fa2c`](https://github.com/eigilsagafos/valdres/commit/979fa2c8e6038f25eb820e15f2d12730e153f39b),
  [`8393f22`](https://github.com/eigilsagafos/valdres/commit/8393f22a408b886a6ff83179eba65cd3a6da1513),
  [`ab18cae`](https://github.com/eigilsagafos/valdres/commit/ab18cae6b96885c9afd2cfd81fc6336f7a7788d6),
  [`69b0e6d`](https://github.com/eigilsagafos/valdres/commit/69b0e6da6c1c6a62e900d9e48d13d75340764982),
  [`fa8db1b`](https://github.com/eigilsagafos/valdres/commit/fa8db1b83675544d68cba2000df708b606f54511),
  [`f8a555a`](https://github.com/eigilsagafos/valdres/commit/f8a555a1b99139f63b16c737f9b49e6aee60fc2f),
  [`9f011c9`](https://github.com/eigilsagafos/valdres/commit/9f011c915d4c8a1fbb2b3e886014890444e93afc),
  [`37c9afa`](https://github.com/eigilsagafos/valdres/commit/37c9afae8c6aae6b0f4e9a2b8b38b32d3c3ca7bd),
  [`0f3ce03`](https://github.com/eigilsagafos/valdres/commit/0f3ce03669b3ac92b26d1d047e850b6005a924fe)]:
    - valdres@1.0.0-beta.4

## 0.1.0-beta.1

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
