---
"valdres-vue": minor
---

Full breaking 1.0 rework of the Vue 3 adapter — removes the two React
assumptions that broke Vue (thrown-promise async, once-captured arguments), adds
the SSR/provider tier the other adapters have, and adopts the 2026 Vue idiom end
to end. Pre-1.0, so no aliases or compat shims.

**`createValdres()` returns an instance (breaking).** It now returns a
Pinia-shaped `{ install, store }` instead of a bare plugin closure. The store is
created in the `createValdres()` body (not inside `install`), so `valdres.store`
is available immediately. `app.use(valdres)` still works (Vue accepts install
objects). New `hydrate` / `hydrateOptions` options apply a core `dehydrate(store)`
payload during creation for SSR; the existing `initialize` runs first so
hydrated values win. Atoms with a codec schema round-trip
`BigInt`/`Date`/`Map`/`Set` over plain JSON — no Vue-side serializer.

**Async selectors no longer throw (breaking).** `useValue`/`useAtom` previously
`throw`ed promise-like values (React's Suspense protocol, which Vue does not
have — the promise routed to `errorCaptured` and the component never recovered).
Now they never throw: on a pending async selector or promise atom default the
ref reads `undefined` and holds the last resolved value. New
`useAsyncValue(state, store?)` returns the Pinia Colada / TanStack vue-query v5
shape — `{ data, error, isPending, status, suspense }` — with
`await useAsyncValue(sel).suspense()` for async `setup()` under `<Suspense>`
(it loops await→re-get to resolve through chained dependency promises).

**Reactive arguments via `MaybeRefOrGetter`.** `useValue`/`useAtom`/`useSetAtom`/
`useResetAtom`/`useAsyncValue` accept a ref or getter for `state`, so
`useValue(() => todoFamily(props.id))` re-subscribes when the prop-driven family
key changes (previously frozen to the mount-time key). The positional
`store?: Store` second parameter is unchanged (cross-adapter convention).

**`useValue` is read-through (breaking-ish).** It is now a read-through
`customRef` like `useAtom`, so `.value` is fresh immediately after a
`store.set` on the default batched store (previously stale for a microtask). A
direct `.value` read no longer freezes after unmount — reactivity (effects/watch)
still stops on unmount. A chained `computed()` stays microtask-deferred.

**`provideValdresScope(options?)` (new).** The composable form of
`ValdresScope`, so a `<script setup>` component can scope itself; returns the
scoped store. `ValdresScope` is now sugar over it. The default `scopeId` is
`useId()` (SSR-stable on Vue 3.5+, feature-detected with a random fallback),
replacing `Math.random()`. `scopeId` is intentionally non-reactive (provided
context is captured once); a dynamic id needs `:key`, and changing it without a
remount warns in dev.

**Smaller fixes.** `useTransaction` forwards core's devtools `name`
(`txn(cb, name?)`). The local `InitializeCallback` type and `hydrate` helper are
replaced by core's shipped `InitializeCallback` / `setAtomPairs`. Stale
`@ts-ignore` comments and the `= any` generic default are removed; `useValue`
returns `Readonly<ShallowRef<Value>>`. `package.json` gains `sideEffects: false`
and bounds the vue peer range to `>=3.3 <4`. New type exports: `Valdres`,
`ValdresOptions`, `AsyncValue`, `ProvideValdresScopeOptions`.

Full docs rewrite: `quick-start-vue` and every per-export page reflect the
as-built API, plus new `useAsyncValue` and `provideValdresScope` pages.
