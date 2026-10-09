# Jotai compatibility on Valdres v1

`@valdres-react/jotai` implements Jotai's core API (`jotai`, i.e. `jotai/vanilla`
plus `jotai/react`) on the public Valdres v1 API. It is release-ignored: nothing
here is published. This file records what is and is not compatible, and how
that was established.

## Reference version

**Jotai 3.0.1** (npm `jotai@3.0.1`, git tag `v3.0.1`, commit
`6abd0ae3365e02ab432fba4b6e8e6f00aafbf508`), the current `latest`.

- Jotai 3's [migration guide](https://github.com/pmndrs/jotai/blob/v3.0.1/docs/guides/migrating-to-v3.mdx)
  states the public API is unchanged from v2 apart from removals (`setSelf`,
  `useAtomValue`'s `delay`, `atomFamily`/`loadable` utils moving out). The
  previous adapter targeted 2.20.2; 3.0.1 is that API minus what was removed.
- Executable reference: the adapted upstream suite (`test/upstream/`) runs
  against the real `jotai@3.0.1` (devDependency alias `jotai-reference`) with
  `bun run test:reference`: **231/231 pass**. The same files run against this
  package with `bun run test:upstream`.

## Previous package (1.0.0-beta.3) inventory

The published `1.0.0-beta.3` was written for the pre-v1 core. On a fresh
install today (`valdres@1.0.0-beta.44`, `valdres-react@1.0.0-beta.8`) it fails to
load: `valdres/adapter-internals/v1` no longer exports `SelectorEvaluationError`.
In the workspace its source failed to import `isPromiseLike`/`isSuspendError`.

| Export                                                                                                                  | Before                                                                                        | Now                                                                   |
| ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `atom`                                                                                                                  | returned Valdres atoms/selectors, relied on removed async atoms/selectors and mutable stores | returns Jotai atom configs; Valdres definitions are built per config |
| `createStore`                                                                                                           | patched a Valdres Store's methods in place                                                   | Jotai-shaped `{ get, set, sub }` over a private Valdres Store         |
| `getDefaultStore`                                                                                                       | `globalThis._valdresJotaiDefaultStore`                                                        | one store per module copy, as in Jotai                                |
| `Provider`                                                                                                              | `valdres-react`'s Provider (required `store`)                                                | Jotai's Provider: optional `store`, otherwise owns one per instance   |
| `useAtom`, `useAtomValue`, `useSetAtom`, `useStore`                                                                     | wrappers over `valdres-react` (`useSyncExternalStore`)                                        | ports of Jotai 3.0.1's hooks over the store                          |
| types `Atom`, `WritableAtom`, `PrimitiveAtom`, `Getter`, `Setter`, `ExtractAtomValue/Args/Result`, `SetStateAction` | re-exported from `jotai/vanilla`, an undeclared dependency                                    | defined in `src/types/jotai.ts` (Jotai's, minus `signal`)            |
| type `Store`                                                                                                            | —                                                                                             | added (Jotai exports it; `createStore` returns it)                   |
| `src/utils/atomFamily`, `src/utils/atomWithLazy`                                                                        | not exported (`exports` has only `.`); `atomFamily` re-exported `jotai/utils` at runtime      | removed                                                               |

The package no longer depends on `valdres-react`; it peers on `valdres`
`^1.0.0-beta.44` and `react` `^18.0.0 || ^19.0.0`, and imports only `valdres`'s
root entry and `react`.

## How it maps onto Valdres

- **Atoms** are Jotai's plain config objects (`read`, optional `write`, `init`,
  `toString`, `debugLabel`, `onMount`). Each config gets Valdres definitions the
  first time any store uses it: `init` becomes an `atom.lazy` holding the
  atom's own value; a non-primitive `read` becomes a `selector`. Definitions are
  store-independent and weakly held, so there is one Valdres runtime graph.
  Atoms made by `jotai`'s own `atom()` work too (the store reads configs
  structurally, as Jotai's does).
- **Writes** run Jotai's write functions outside Valdres. Sets are staged in a
  buffer that later `get`s read back, then committed in one Valdres
  transaction, so subscribers are notified once, after the write. Reads before
  the first set hit the committed cache.
- **Listeners** (`store.sub`) run as Valdres `settle` handlers, so they can
  write synchronously.
- **onMount** uses one constant `externalAtom` per writable config with
  `onMount`: Valdres attaches it while the atom is retained in a store, directly
  or through dependents, which is Jotai's mount lifetime. Attach/detach happen
  synchronously inside the store operation that caused them; the store queues
  `onUnmount`/`onMount` and runs them after its listeners, batching their
  `setAtom` calls, as Jotai's flush does.
- **Promises** are ordinary values in Jotai. Valdres v1 rejects thenables, so
  the adapter stores each one in one canonical inert box. Identity and
  `Object.is` change detection are Jotai's.
- **Suspense**: the hooks are Jotai's (`useReducer` + `useEffect`, `use()` on
  React 19, a throwing shim on React 18). Jotai's continuable promise is ported;
  where Jotai learns that a promise was replaced by aborting it, this store
  re-reads the atom after each operation while a component waits.
- **Default store**: lives in this package, like Jotai's. Valdres core has no
  default or global Store.

## Support matrix

Preserved means covered by passing upstream Jotai tests and/or differential
tests that compare traces with real Jotai 3.0.1.

| Area                                                                                         | Status                                         |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Primitive atoms, `atom()`, functional setters, function values via `atom(() => fn)`         | Preserved                                      |
| Derived read-only atoms, dependency tracking (sync), `Object.is` bail-out                    | Preserved                                      |
| Writable derived, write-only (`atom(null, write)` reads `null`), `atom(init, write)`        | Preserved                                      |
| Write arguments (variadic) and return values, nested writes, async write functions          | Preserved                                      |
| A throwing write keeps earlier sets; errors from reads are the original thrown value        | Preserved                                      |
| `createStore`, `getDefaultStore`, `store.get/set/sub`, unsubscribe idempotence               | Preserved                                      |
| Listener writes, listener errors as `AggregateError`, listener sub/unsub                     | Preserved (timing differences below)           |
| `onMount`/`onUnmount`, transitive and dynamic mounts, `setAtom` batching, StrictMode remount | Preserved                                      |
| `Provider` with/without `store`, `useStore`, hooks' `{ store }` option                        | Preserved                                      |
| `useAtom`, `useAtomValue`, `useSetAtom`, `useTransition` updates                             | Preserved                                      |
| Promise values, async read functions with synchronous `get`s, Suspense, error boundaries     | Preserved                                      |
| Suspense following a replaced promise (continuable promise)                                  | Preserved                                      |
| SSR (`renderToString`) and hydration                                                         | Preserved (same model as Jotai: no snapshots)  |
| React 18.3 and 19.1                                                                          | Preserved (packed consumer)                    |
| `get()` after `await` (late dependencies)                                                    | Unsupported: throws `VALDRES_JOTAI_LATE_GET`   |
| Read `options.signal`                                                                        | Unsupported: throws; **owner decision** (D1)   |
| `INTERNAL_onInit`                                                                            | Unsupported: throws                            |
| Store methods inside a read function                                                         | Unsupported: Valdres `SelectorCapabilityError` |
| A listener operating on a different store                                                    | Unsupported: Valdres `TransactionPhaseError`   |
| `useAtomValueRaw`, `useAtomValueRawSync`, `INTERNAL_*`, `jotai/utils`, `jotai/vanilla/internals` | Not provided                               |
| Interop with native Valdres States/hooks                                                     | Not provided; **owner decision** (D4)          |

### Behavioral differences (supported, observably different)

Each is asserted against both implementations in `test/adapter/differential.test.ts`
or listed in `test/upstream/gaps.ts`.

1. **Unmounted derived atoms recompute eagerly.** Valdres v1 recomputes a
   previously read, unsubscribed selector whenever a dependency changes; Jotai
   recomputes on the next read. An async read function that was read once runs
   again (for example refetches) on every dependency change. Core behavior:
   ```ts
   const a = atom(1); let runs = 0
   const s = selector(get => (runs++, get(a)))
   const app = store(); app.get(s)
   app.set(a, 2); app.set(a, 3) // runs === 3
   ```
2. **Derived values read inside a transaction are recomputed.** Valdres
   transaction reads re-evaluate selectors instead of reusing the committed
   cache (the parked "C3" overlay work). So a derived atom read by a listener,
   or by a write function after it set something, is recomputed: equal value,
   possibly a new object identity, extra read-function calls.
3. **Sibling `onMount` order is reversed.** Valdres attaches a selector's
   dependencies in reverse read order. Dependencies still mount before their
   dependents.
4. **Net-zero writes do not notify.** `set(a, 1); set(a, 0)` in one write
   notifies `a`'s listeners in Jotai, not here (the committed value is
   unchanged).
5. **A listener on two changed atoms runs twice** (once per atom); Jotai runs it
   once per flush.
6. **A listener's own write notifies other listeners after it returns**; Jotai
   notifies them inside the `set` call.
7. **Stack overflow in a too-deep graph** is cached as the atom's error, so a
   later `store.sub` does not rethrow it. Dependency cycles fail with
   `SelectorCircularDependencyError` instead of overflowing.
8. `toString()` includes `debugLabel` in production builds too.

## Gaps that cannot be handled faithfully

### G1. Dependencies read after `await` (25 upstream tests)

```ts
const total = atom(async get => {
    const a = get(aAtom)
    await somethingAsync()
    return a + get(bAtom) // throws VALDRES_JOTAI_LATE_GET (rejects the atom's promise)
})
```

Jotai keeps tracking `get` calls made after the read function returned. Valdres
v1 selectors record dependencies only while the getter runs synchronously and
revoke its `get` afterwards (`SelectorReadRevokedError`). Reading the current
value untracked would silently go stale; tracking it would need a dependency
mechanism outside Valdres (a second engine). **Boundary:** an explicit
`JotaiCompatibilityError` with code `VALDRES_JOTAI_LATE_GET`. **Migration:**
call every `get` before the first `await`
(`const [a, b] = [get(aAtom), get(bAtom)]`); `await get(asyncAtom)` itself is
fine because the `get` call is synchronous.

### G2. `options.signal` (7 upstream tests)

Jotai aborts a read's signal when the store replaces the promise that read
produced. Selector getters do not know which store evaluates them or whether
the evaluation is committed or a discarded transaction scratch, so the adapter
cannot tell when to abort. A signal that never aborts would be a no-op
pretending to be support. **Boundary:** reading `signal` throws
`VALDRES_JOTAI_SIGNAL_UNSUPPORTED`; the type has no `signal`, so typed code fails
to compile. See D1.

### G3. `INTERNAL_onInit` (7 upstream tests)

Jotai's documented-internal per-store initialization hook, used by
`jotai/utils`' `unwrap` and store-derivation experiments. A per-store callback
that receives the store and usually writes during the first read has no
capability-safe equivalent in Valdres. **Boundary:** first use throws
`VALDRES_JOTAI_INTERNAL_ON_INIT_UNSUPPORTED`.

### G4. Store calls inside read functions (2 upstream tests)

Jotai warns ("store mutation during read") but allows `store.get`/`store.set`
inside a read function. Valdres forbids Store calls from selector callbacks.
**Boundary:** Valdres' `SelectorCapabilityError` surfaces unchanged.

### G5. Cross-store calls from listeners

A listener runs inside a Valdres `settle` transaction, where any other Store
operation throws `TransactionPhaseError`; Jotai allows it. The error is
collected into the operation's `AggregateError`, and the listener's own writes
are kept.

### G6. `onMount` assigned after first use

An atom from this package that a store has already used without `onMount` has
Valdres definitions without a mount sentinel. Assigning `onMount` then throws
`VALDRES_JOTAI_ON_MOUNT_AFTER_FIRST_USE` instead of being ignored. Configs made
by `jotai`'s own `atom()` always get a sentinel, so they accept it.

## Decision brief

None of these block the migration as implemented; each is a choice the owner
should confirm.

- **D1. `signal`.** Keep throwing (current), or attempt abort-on-supersession by
  attributing each evaluation to a store and to committed vs scratch work. That
  attribution depends on Valdres internals not evaluating selectors
  speculatively outside transactions; a wrong abort would cancel a live
  request. Recommendation: keep throwing until core can say when a store
  replaces a selector value.
- **D2. Promises as values.** v1 core chose synchronous values only. Boxing
  thenables keeps Jotai's async atoms working without core changes; the
  alternative is to reject async atoms outright, which would drop most existing
  async Jotai code. Recommendation: keep boxing (adapter-only, invisible to
  core).
- **D3. Core behaviors behind differences 1–3.** Eager recomputation of cold
  selectors, transaction reads not reusing the committed cache (C3, parked) and
  reverse attach order are core policies. No core change is made or proposed
  here beyond flagging them; difference 1 matters most for async atoms with
  side effects.
- **D4. Valdres interop.** Jotai atoms are configs, not Valdres States, so they
  cannot be used with `valdres-react` hooks or Valdres stores, and the Jotai
  `Provider` does not provide a Valdres Store. A future export (for example a
  config → `State` accessor) would be new API.
- **D5. Release.** The package stays in `.changeset/config.json` `ignore`, and
  the published `1.0.0-beta.3` does not load against current Valdres. Releasing
  needs a CI gate (proposal below) and adding it to
  `scripts/publishable-packages.json`; otherwise consider deprecating
  `1.0.0-beta.3` on npm.

## Verification

```bash
cd packages/@valdres-react/jotai
bun run test             # adapter + upstream (adapter) + upstream (real Jotai)
bun run typecheck:tests  # source and declaration contract
bun run test:packed      # tarballs, React 18 + 19, Node + Bun, SSR, hydration, types
```

- `test/upstream/`: 231 Jotai 3.0.1 tests, one file per process. Against Jotai:
  231 pass. Against this package: 182 pass, 45 listed gaps verified to still
  fail, 4 skipped (3 use `useAtomValueRawSync`; 1 late-`get` test whose
  rejection escapes the test body). A listed gap that starts passing, or a gap
  that matches no test, fails the run.
- `test/adapter/`: differential scenarios against Jotai (writes, listeners,
  mounts, promises; documented differences asserted on both), explicit
  boundaries, and React (StrictMode lifecycle, Provider ownership, SSR +
  hydration, Suspense, error boundaries) compared with Jotai's own hooks.
- `test/types/declarations.tsx`: type contract; the same assertions also hold
  for `jotai@3.0.1`'s types except the removed `signal`.
- `test/packed/`: builds and `npm pack`s `valdres` and this package with the
  repository's `scripts/prepack.ts`, installs them with React 18.3.1 and
  19.1.1, runs vanilla/SSR/DOM fixtures on Node and Bun, runs Node with the
  `development` condition, and type-checks the packed declarations with `tsc`
  (NodeNext, `skipLibCheck: false`). Source manifests must be unchanged.

### CI proposal (not wired)

These commands are package-local and not part of `bun run verify` or CI. A
release-enabling change would add a `jotai` job to `.github/workflows/ci.yaml`
running the three commands above, as the hotkeys and browser packages have.

### Performance

Informational, two runs on a loaded laptop (median of 7, `NODE_ENV=production`):
the adapter was roughly 1.3–3x slower than Jotai on micro-benchmarks
(primitive set with a listener, a mounted 3-level derived chain, write atoms with
two sets), mainly from per-write transactions and per-atom `settle` handlers. No
budget is claimed.
