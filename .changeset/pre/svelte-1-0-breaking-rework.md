---
"valdres-svelte": minor
---

Full breaking 1.0 rework of the Svelte 5 adapter — fixes the broken published
artifact, adopts the 2026 Svelte idiom end to end, and adds the provider tier
the other adapters already have.

**Packaging (fixes a fundamentally broken npm artifact).** The package now
ships uncompiled source via `@sveltejs/package` (`svelte-package`) with an
exports map of `{ "types", "svelte", "default" }` and `"sideEffects": false`,
the way every Svelte 5 library ships. Previously the build bundled runes into
plain JS (`$state is not defined` in consumers) and `prepack` dropped the
`svelte` export condition, so the package only worked inside the monorepo. The
prepack exports rewrite is now special-cased to leave this package's
dist-pointing conditions untouched, and CI runs `publint` + `svelte-check`
against the packed tarball so it can't regress. The svelte peer dependency is
bumped to `>=5.7` (for `createSubscriber`).

**Renames (breaking).**

- `watch` → `fromState`. `watch` collided with runed's `watch` (an
  effect-with-deps helper). `fromState` mirrors svelte/store's `fromStore`.
- `readable` → `toStore`. `readable` shadowed svelte/store's `readable`;
  `toStore` mirrors svelte/store's own conversion verb.
- `.value` → `.current`. The reactive box now exposes `.current` (the Svelte 5
  idiom shared by `fromStore`, Spring, Tween, MediaQuery, and all of runed)
  instead of `.value` (a Vue ref-ism).

**`fromState` (breaking).** Returns `{ get current(), set current(v), update(fn), reset() }`
for atoms and `{ readonly current }` for selectors, so `bind:value={box.current}`
and `box.current++` work. Plain sets go through `box.current = v`; the
read-modify-write updater is `box.update(c => c + 1)` (mirroring
`svelte/store`'s `Writable.update`). The `current` setter wraps the value in a
thunk so a function value is stored verbatim rather than treated as an updater.
Async
selectors are now typed honestly as `current: V | Promise<V>` — consume with
`{#await box.current then v}` (core erases asyncness, so the union is the
honest adapter-level type). Rebuilt on `createSubscriber` from
`svelte/reactivity`: the underlying valdres subscription is now lazy and shared.

**Behavior change — lazy bootstrap.** With lazy subscription, a valdres
`onMount`-driven atom (the `@valdres/browser-*` pattern) only bootstraps once
`.current` is read inside an effect — components that read the value solely in
an event handler will see the unbootstrapped default. This matches Svelte's own
`MediaQuery` semantics.

**`toStore` (breaking).** An atom now yields a `Writable<V>` (`subscribe` /
`set` / `update`, delegating to the store) so `$count$ = 5`, `count$.set(...)`,
and `bind:value={$count$}` work; a selector stays a read-only `Readable<V>`.
The `store` argument is now optional and defaults to the context store
(`getValdresContext()`), consistent with every other primitive.

**Provider tier (new).**

- `setValdresContext(storeOrOptions?)` — the no-arg form auto-creates
  `store({ batchUpdates: true })` per component tree (= per SSR request, the
  canonical SvelteKit pattern); warns when handed a non-batched store; runs
  `initialize` inside a transaction (via core's shipped `InitializeCallback` /
  `setAtomPairs`); and applies a `hydrate` payload (core `dehydrate`/`hydrate`,
  which round-trips `BigInt`/`Date`/`Map`/`Set` over plain JSON for atoms with a
  codec schema — no custom serializer). When both are given, `initialize` runs
  first so hydrated/transferred values win.
- `scope(scopeId?, { initialize })` — backward-compatible signature extension
  for per-scope seeding, parity with the other adapters.
- `transaction(store?)` — returns a runner bound to the context store captured
  at component init, so it's safe to call from an event handler (Svelte throws
  `lifecycle_outside_component` for `getContext` outside init); forwards core's
  devtools `name`.
- The Svelte context now lives under `Symbol.for("valdres")` (was the bare
  string `"valdres-store"`) and holds the cross-adapter
  `{ current, stores }` shape; `getValdresContext()` still returns the current
  `Store`.

**`resourceState(sel, store?)` (new).** Returns
`{ current: V | undefined, loading: boolean, error: unknown }` for a possibly
async selector, doing the `isPromiseLike` detection and tracking promise
settlement.

**Type exports.** `FromStateAtom`, `FromStateValue`, `ResourceState`,
`ScopeOptions`, `SetValdresContextOptions`, and `ValdresContext` are now
exported.
