# Jotai compatibility on Valdres v1

`@valdres-react/jotai` is a **partial** implementation of Jotai's core API
(`jotai`, i.e. `jotai/vanilla` plus `jotai/react`) on the public Valdres v1 API.
It is not complete Jotai compatibility: the gaps below are listed, tested and
explained. The package is release-ignored; nothing here is published.

## Reference versions

- **Jotai 3.0.1** (npm `jotai@3.0.1`, tag `v3.0.1`, commit
  `6abd0ae3365e02ab432fba4b6e8e6f00aafbf508`), the current `latest`, installed
  as the devDependency alias `jotai-reference`. Its
  [migration guide](https://github.com/pmndrs/jotai/blob/v3.0.1/docs/guides/migrating-to-v3.mdx)
  states the public API is unchanged from v2 apart from removals (`setSelf`,
  `useAtomValue`'s `delay`, `atomFamily`/`loadable` moving out). The previous
  adapter targeted 2.20.2.
- **Consumers:** `jotai/utils` from that same `jotai@3.0.1` package,
  **jotai-family 1.1.0** (tag `v1.1.0`, commit
  `c67cbdbf8b028fb6bee752d07b80a100ce3c5427`; it imports Jotai for types only),
  and `rxjs` 7.8.2 / `wonka` 6.3.6 for the `atomWithObservable` tests.

## Upstream matrix

`test/upstream/` holds 364 tests copied from Jotai 3.0.1 and jotai-family 1.1.0
(35 files, one process per file). Every file runs against real Jotai and
against this package; `test/upstream/gaps.ts` lists each test this package does
not pass, with its reason.

| Suite                                                                                   | Tests | Real Jotai | This package                                              |
| --------------------------------------------------------------------------------------- | ----: | ---------: | --------------------------------------------------------- |
| Core API (`vanilla/*`, `react/*`, incl. `useAtomValueRaw`/`RawSync`)                    |   245 |        245 | 199 pass, 45 gaps verified to fail, 1 skipped             |
| `jotai/utils` (vanilla and React-hook tests) and jotai-family                           |   119 |        119 | 104 pass, 4 gaps verified to fail, 11 skipped (`unwrap`) |
| **Total**                                                                               |   364 |        364 | **303 pass, 49 known gaps verified failing, 12 skipped**  |

A listed gap that starts passing, or a listed gap that matches no test, fails
the run. Skipped tests are the ones whose failure escapes the test body (a
rejection thrown inside the library's own promise callbacks).

Gaps by reason:

| Count | Kind        | Reason                                                                                   |
| ----: | ----------- | ---------------------------------------------------------------------------------------- |
|    27 | unsupported | `get()` after the read function returned (`VALDRES_JOTAI_LATE_GET`), 1 skipped         |
|    11 | unsupported | `unwrap`: `INTERNAL_onInit`, `get()` in promise callbacks, previous-value self-reads (skipped) |
|     7 | unsupported | read `options.signal` (`VALDRES_JOTAI_SIGNAL_UNSUPPORTED`)                               |
|     7 | unsupported | `INTERNAL_onInit` (`VALDRES_JOTAI_INTERNAL_ON_INIT_UNSUPPORTED`)                         |
|     2 | unsupported | Store calls inside a read function (Valdres `SelectorCapabilityError`)                   |
|     3 | divergence  | previously read, unsubscribed derived atoms recompute eagerly                            |
|     2 | divergence  | a derived atom with `init` reading itself does not get its previous computed value      |
|     1 | divergence  | sibling `onMount` order reversed                                                         |
|     1 | divergence  | stack overflow cached as the atom's error                                                |

### Supported consumer surface

- **Run against this package, passing:** `atomWithReset`, `atomWithReducer`,
  `atomWithDefault` (sync), `atomWithLazy`, `atomWithRefresh`, `atomWithStorage`,
  `atomWithObservable` (rxjs and wonka), `freezeAtom`, `RESET`, and
  jotai-family's `atomFamily` and `atomTree`.
- **Partially:** `selectAtom` and `splitAtom` return correct values but lose
  their identity-preserving optimizations (previous-value self-read);
  `atomWithDefault` with an async default reads after `await`.
- **Not supported:** `unwrap`.
- **Not provided:** `jotai/react/utils` (`useHydrateAtoms`, `useAtomCallback`,
  `useResetAtom`, `useReducerAtom`). Those hooks bind to Jotai's own React
  context and default store, so they would need ports onto this package's
  hooks. `jotai/vanilla/internals`, `INTERNAL_overrideCreateStore` and Jotai's
  dev store hooks are not provided either.

## Previous package (1.0.0-beta.3) inventory

The published `1.0.0-beta.3` was written for the pre-v1 core. On a fresh
install today (`valdres@1.0.0-beta.44`, `valdres-react@1.0.0-beta.8`) it fails to
load: `valdres/adapter-internals/v1` no longer exports `SelectorEvaluationError`.

| Export                                                                                                                  | Before                                                                                        | Now                                                                   |
| ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `atom`                                                                                                                  | returned Valdres atoms/selectors, relied on removed async atoms/selectors and mutable stores | returns Jotai atom configs; Valdres definitions are built per config |
| `createStore`                                                                                                           | patched a Valdres Store's methods in place                                                   | Jotai-shaped `{ get, set, sub }` over a private Valdres Store         |
| `getDefaultStore`                                                                                                       | `globalThis._valdresJotaiDefaultStore`                                                        | one store per module copy, as in Jotai                                |
| `Provider`                                                                                                              | `valdres-react`'s Provider (required `store`)                                                | Jotai's Provider: optional `store`, otherwise owns one per instance   |
| `useAtom`, `useAtomValue`, `useSetAtom`, `useStore`                                                                     | wrappers over `valdres-react` (`useSyncExternalStore`)                                        | ports of Jotai 3.0.1's hooks over the store                          |
| `useAtomValueRaw`, `useAtomValueRawSync`                                                                                | —                                                                                             | added: ports of Jotai 3.0.1's hooks                                   |
| types `Atom`, `WritableAtom`, `PrimitiveAtom`, `Getter`, `Setter`, `ExtractAtomValue/Args/Result`, `SetStateAction` | re-exported from `jotai/vanilla`, an undeclared dependency                                    | defined in `src/types/jotai.ts` (Jotai's, minus `signal`)            |
| type `Store`                                                                                                            | —                                                                                             | added (Jotai exports it; `createStore` returns it)                   |
| `src/utils/atomFamily`, `src/utils/atomWithLazy`                                                                        | not exported (`exports` has only `.`); `atomFamily` re-exported `jotai/utils` at runtime      | removed (use `jotai-family` / `jotai/utils`, see above)              |

The package peers on `valdres` `^1.0.0-beta.44` and `react`
`^18.0.0 || ^19.0.0`, and imports only `valdres`'s root entry and `react`.

## How it maps onto Valdres

- **Atoms** are Jotai's plain config objects. Each config gets Valdres
  definitions the first time any store uses it: `init` becomes an `atom.lazy`
  holding the atom's own value; a non-primitive `read` becomes a `selector`.
  Definitions are store-independent and weakly held: one Valdres runtime graph.
  Configs made by `jotai`'s own `atom()` (and so by `jotai/utils`) work too.
- **Writes** run Jotai's write functions outside Valdres. Sets are staged in a
  buffer that later `get`s read back and are committed in one Valdres
  transaction, so derived atoms never see a half-applied write. Reads before the
  first set hit the committed cache.
- **Listeners**: each mounted atom has one plain Valdres subscription that only
  records that the atom changed. After the Valdres operation returns, the store
  runs Jotai's `flushCallbacks`: listeners of changed atoms (each listener once),
  then `onUnmount`, then `onMount`, repeated while new work appears. Listeners
  therefore run outside any Valdres transaction and may read, write,
  (un)subscribe and use other stores, as in Jotai.
- **onMount** uses one constant `externalAtom` per writable config with
  `onMount`. Valdres attaches it while the atom is retained in a store, directly
  or through dependents, which is Jotai's mount lifetime. Attach and detach run
  synchronously inside the Valdres call that retained or released it; every
  Valdres call this package makes runs inside a per-store operation frame, so the
  event is attributed to that store. A sentinel reached outside such a frame
  throws `VALDRES_JOTAI_LIFECYCLE_OUTSIDE_OPERATION` instead of guessing.
- **Promises** are ordinary values in Jotai. Valdres v1 rejects thenables, so
  the adapter stores each one in one canonical inert box: identity and
  `Object.is` change detection are Jotai's. This is separate from dependency
  tracking: dependencies read after `await` are not tracked (G1).
- **Suspense**: the hooks are Jotai's (`useReducer` + `useEffect`, `use()` on
  React 19, a throwing shim on React 18). Jotai's continuable promise is ported;
  where Jotai learns that a promise was replaced by aborting it, this store
  re-reads the atom after each operation while a component waits.
- **Default store** lives in this package, like Jotai's. Valdres core has no
  default or global Store.

## Evidence beyond the upstream suite (`test/adapter/`)

Each scenario runs in-process against real Jotai and this package; traces must
be equal unless a difference is asserted on both sides.

- `listeners.test.tsx` (10): listener reads see the committed derived object
  that `store.get` returns; listener writes are visible immediately and notify
  inside the `set`; a write that changes and restores an atom notifies it; one
  listener on several changed atoms runs once; listeners may use other stores,
  subscribe (mounting immediately) and unsubscribe (unmounting); listener errors
  keep earlier writes and surface as `AggregateError`; one write renders a
  component once with the final state.
- `ownership.test.ts` (7): two stores sharing a graph each mount, write and
  unmount their own copy; interleaved operations (one store's `onMount` and
  listeners operating on another) stay attributed; a dependency change in one
  store does not move the other's mounts; a throwing `onMount`/`onUnmount` affects
  only that store; plain reads, scratch reads inside writes and eager
  recomputation mount nothing; a sentinel reached outside any store operation,
  including through a Valdres child scope, throws. Jotai stores have no
  `dispose`; an unreferenced store is collectable (`boundaries.test.ts`).
- `promises.test.tsx` (7): pending, resolved and rejected promises keep their
  identity and settling does not notify; promises returned by read functions are
  observed so rejections are handled; a stale promise resolving after its
  replacement is ignored, and a rejected replacement reaches the error boundary;
  unmounting while suspended and remounting shows the resolved value; Suspense
  stops observing the store once the promise settles; a replaced promise is
  collectable.
- `differential.test.ts`, `react.test.tsx`, `boundaries.test.ts`: writes,
  mounts, StrictMode lifecycle, Provider ownership, SSR and hydration, Suspense
  and error boundaries, and the explicit unsupported boundaries.
- `test/types/declarations.tsx`: type contract, also satisfied by Jotai's own
  types except the removed `signal`.
- `test/packed/`: prepacked tarballs installed with React 18.3.1 and 19.1.1 on
  Node and Bun, SSR, hydration, StrictMode, Suspense, the `development` export
  condition, and the packed declarations under `tsc` (NodeNext,
  `skipLibCheck: false`).

## Gaps: adapter-induced or core policy

| Gap                                                     | Tests | Cause                                                                                          | Without core changes                                                                                         |
| ------------------------------------------------------- | ----: | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| G1 `get()` after `await`                                |    27 | Core: dependencies are recorded only while a getter runs; its `get` is revoked afterwards      | Emulation possible (store-attributed revision atoms + subscriptions); not built, awaiting the core assessment |
| G2 `options.signal`                                     |     7 | Core: a getter is not told its Store or whether its result commits                             | Emulation possible with store attribution; not built, same reason                                            |
| G3 `INTERNAL_onInit`                                    |     7 | Core: no per-store hook that may write during a first read                                     | Partial at best (only first use through a store method)                                                     |
| G4 Store calls inside reads                             |     2 | Core: selector callbacks may not call Store methods                                           | No faithful option: an untracked read inside a getter does not exist                                         |
| G5 previous-value self-read (`selectAtom`, `splitAtom`) |     2 | Core: a selector cannot read its own previous result (self-read is a fatal cycle)             | Only with a per-store shadow copy of selector results (a second state store): not done                      |
| G6 `unwrap`                                             |    11 | G1 + G3 + G5                                                                                   | —                                                                                                            |
| D1 eager recompute of unsubscribed derived atoms        |     3 | Core policy                                                                                    | None                                                                                                         |
| D2 sibling `onMount` order                              |     1 | Core: siblings attach in reverse read order (regression of #253)                               | None                                                                                                         |
| D3 stack overflow                                       |     1 | Core caches stack exhaustion as an ordinary error; the engine leaves no marker to detect it    | None without matching error messages                                                                         |
| D4 derived values read inside a write after a set       |     — | Core: transaction reads re-evaluate selectors (parked C3)                                      | Alternative (commit before the read) would expose half-applied writes to mounted derived atoms              |

**Eliminated without core changes in this revision:** listeners reading
recomputed derived values, listener writes notifying only after the listener
returned, net-zero writes not notifying, a listener on two atoms running twice,
cross-store calls from listeners failing (`TransactionPhaseError`), and
listener (un)subscription being deferred. All came from running listeners as
`settle` handlers. Adding `useAtomValueRaw`/`RawSync` passes 3 former
`not-applicable` tests and 14 more upstream tests.

**Not changed, by decision:** a `store.set` inside a read whose write function
only reads could reuse the evaluation's `get`, but those reads would become
tracked dependencies, unlike Jotai.

### Smallest remaining core requirements

1. **Smallest change:** attach a selector's dependencies in read order (D2).
   ```ts
   import { externalAtom, selector, store } from "valdres"
   const order: string[] = []
   const ext = (name: string) =>
       externalAtom({ getSnapshot: () => 0, subscribe: () => (order.push(name), () => {}) })
   const first = ext("first"), second = ext("second")
   store().sub(selector(get => (get(first), get(second))), () => {})
   console.log(order) // ["second", "first"]; #253 established ["first", "second"]
   ```
2. **Smallest new capability:** let a selector read its own previous result in
   the Store it is evaluating for (G5; with G1 and G3 it would also cover
   `unwrap`). Jotai's official `selectAtom`, `splitAtom` and `unwrap` depend on
   it.
   ```ts
   import { atom, selector, store } from "valdres"
   const source = atom({ id: 1, name: "a" })
   const slice: any = selector(get => {
       let previous: { id: number } | undefined
       try {
           previous = get(slice) // Jotai: the previous value; Valdres: a cycle
       } catch (error) {
           console.log((error as { code?: string }).code) // VALDRES_SELECTOR_CIRCULAR_DEPENDENCY
       }
       const next = { id: get(source).id }
       return previous?.id === next.id ? previous : next
   })
   store().sub(slice, () => {}) // throws SelectorCircularDependencyError: the cycle latches even when caught
   ```

G1–G3 do not strictly need core: the ownership tests show the per-store
operation frame attributes every Valdres call this package makes. Whether to
emulate them that way or add an evaluation-context primitive to core is pending
the core assessment.

## Other boundaries

- `onMount` assigned after a store already used the atom without one throws
  `VALDRES_JOTAI_ON_MOUNT_AFTER_FIRST_USE` (configs made by `jotai`'s own
  `atom()` always get a sentinel and accept it).
- Dependency cycles fail with `SelectorCircularDependencyError` instead of
  overflowing.
- `toString()` includes `debugLabel` in production builds too.

## Decisions for the owner

- **Signal and late `get`:** emulate with store attribution in the adapter, add
  a core evaluation-context primitive, or keep throwing (current).
- **Promises as values:** keep boxing (adapter-only, invisible to core), or
  reject async atoms outright.
- **Core policies** behind D1–D4 and G5.
- **Valdres interop:** Jotai atoms are configs, not Valdres States; exposing
  their States would be new API.
- **React utils:** port `jotai/react/utils` as a new entry, or leave them out.
- **Release:** stays in `.changeset/config.json` `ignore`. The published
  `1.0.0-beta.3` does not load against current Valdres; consider deprecating it.

## Running

```bash
cd packages/@valdres-react/jotai
bun run test             # adapter suites + upstream (adapter) + upstream (real Jotai)
bun run typecheck:tests  # source and declaration contract
bun run test:packed      # tarballs, React 18 + 19, Node + Bun, SSR, hydration, types
```

These are package-local and not part of `bun run verify` or CI; a release would
need a `jotai` CI job running them.

**Performance**, informational (one run, median of 7, `NODE_ENV=production`,
loaded laptop): the adapter took 2–3.5x Jotai's time on micro-benchmarks (a
primitive set with a listener, a mounted 3-level derived chain, an unmounted
derived read after each set, a write atom with two sets). No budget is claimed.
