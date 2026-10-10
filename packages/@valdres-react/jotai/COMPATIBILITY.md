# Jotai compatibility on Valdres v1

`@valdres-react/jotai` is a **bounded, partial** implementation of Jotai's core
API (`jotai`, i.e. `jotai/vanilla` plus `jotai/react`) on the public Valdres v1
API. It is not complete Jotai compatibility. The package is release-ignored;
nothing here is published.

## Not supported

These throw or behave differently on purpose; each is covered by tests.

| Jotai feature                                            | Here                                                                               |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `get()` after a read function returned (after `await`)   | throws `VALDRES_JOTAI_LATE_GET`: dependencies are tracked only before the first `await` |
| read `options.signal` (cancellation)                     | throws `VALDRES_JOTAI_SIGNAL_UNSUPPORTED`; absent from the types                  |
| `unwrap` from `jotai/utils`                              | does not work (needs both of the above and `INTERNAL_onInit`)                     |
| `INTERNAL_onInit`                                        | throws `VALDRES_JOTAI_INTERNAL_ON_INIT_UNSUPPORTED`                               |
| store calls inside a read function                       | Valdres `SelectorCapabilityError`                                                  |
| `jotai/react/utils`, `jotai/vanilla/internals`           | not provided                                                                       |
| using these atoms with `valdres-react` or Valdres stores | not provided                                                                       |

### Async: what is and is not supported

- **Supported: promises as values.** An atom may hold a promise, a read function
  may return one, and async read functions work when every `get` happens before
  the first `await` (`await get(asyncAtom)` is fine: the `get` call is
  synchronous). Promise identity and change detection, Suspense (`use()` on
  React 19, the throwing shim on React 18), error boundaries, and following a
  replaced promise while suspended match Jotai.
- **Not supported: dependencies read after `await`.** They are not tracked; the
  read throws `VALDRES_JOTAI_LATE_GET`, which rejects the atom's promise.
- **Not supported: cancellation.** There is no `signal`; replaced promises are
  not aborted.

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

| Suite                                                                | Tests | Real Jotai | This package: pass | known failures | skipped |
| -------------------------------------------------------------------- | ----: | ---------: | -----------------: | -------------: | ------: |
| Core API (`vanilla/*`, `react/*`, incl. `useAtomValueRaw`/`RawSync`) |   245 |        245 |                199 |             45 |       1 |
| `jotai/utils` (vanilla and React-hook tests) and jotai-family        |   119 |        119 |                106 |              2 |      11 |
| **Total**                                                            |   364 |        364 |            **305** |         **47** |  **12** |

Every known failure and skipped test is listed in `test/upstream/gaps.ts`. A
known failure runs and must still fail: if one starts passing, or a listed test
no longer exists, the run fails. A skipped test is listed too but not run,
because its failure escapes the test body (a rejection thrown inside the
library's own promise callbacks).

By reason (known failures + skipped = 47 + 12 = 59 listed tests):

| Reason                                                                         | Known failures | Skipped |
| ------------------------------------------------------------------------------ | -------------: | ------: |
| `get()` after the read function returned (`VALDRES_JOTAI_LATE_GET`)            |             26 |       1 |
| `unwrap` (`INTERNAL_onInit`, `get()` in promise callbacks)                     |              0 |      11 |
| read `options.signal` (`VALDRES_JOTAI_SIGNAL_UNSUPPORTED`)                     |              7 |       0 |
| `INTERNAL_onInit` (`VALDRES_JOTAI_INTERNAL_ON_INIT_UNSUPPORTED`)               |              7 |       0 |
| store calls inside a read function (Valdres `SelectorCapabilityError`)         |              2 |       0 |
| previously read, unsubscribed derived atoms recompute eagerly                  |              3 |       0 |
| sibling `onMount` order reversed                                               |              1 |       0 |
| stack overflow cached as the atom's error                                      |              1 |       0 |
| **Total**                                                                      |         **47** |  **12** |

### Supported consumer surface

- **Run against this package, passing:** `atomWithReset`, `atomWithReducer`,
  `atomWithDefault` (sync), `atomWithLazy`, `atomWithRefresh`, `atomWithStorage`,
  `atomWithObservable` (rxjs and wonka), `freezeAtom`, `RESET`, and
  jotai-family's `atomFamily` and `atomTree`.
- **Upstream tests pass, with known identity differences:** `selectAtom` and
  `splitAtom`. Their previous-value self-read is supported through the store's
  previous-result cache (see [How it maps onto Valdres](#how-it-maps-onto-valdres)),
  but values read inside a write after a `set`, eager recomputation and a
  `set(self)` to the stored value still differ from Jotai (tested in
  `test/adapter/previous.test.ts`). They are not claimed fully compatible.
- **Partially:** `atomWithDefault` with an async default (it reads after
  `await`).
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
- **Previous computed values:** Jotai keeps one value slot per atom and store,
  written by reads and sets; a derived atom with `init` reading itself (as
  `selectAtom` and `splitAtom` do) gets that slot. Valdres selectors cannot read
  themselves, so each store keeps, in a `WeakMap`, the last installed outcome
  (value or error) of atoms that read themselves, and returns it while the
  atom's stored value (init or last `set`), which stays a Valdres dependency, is
  unchanged since. Reads inside a write's discarded staged transaction do not
  record. See [Review notes](#review-notes).
- **Listeners** run in a Jotai-style flush after the Valdres operation; see
  [Listener and lifecycle flush](#listener-and-lifecycle-flush).
- **onMount** uses one constant `externalAtom` per writable config with
  `onMount`. Valdres attaches it while the atom is retained in a Store tree,
  directly or through dependents, which is Jotai's mount lifetime. Attach and
  detach run synchronously inside the Valdres call that retained or released it
  (pinned by core's internal tests, not by a public contract). Attach/detach
  identifies a Store *tree*, not a Store; the adapter maps it to a Jotai store
  only because of its isolation:
  - each Jotai store owns a private root Valdres Store and never creates scopes;
  - Jotai graphs contain no ExternalAtom that invalidates (the sentinels are
    constant), so no attach can start outside a Store operation;
  - every Valdres call the store makes runs inside its per-store operation
    frame.

  A sentinel reached outside such a frame throws
  `VALDRES_JOTAI_LIFECYCLE_OUTSIDE_OPERATION` instead of guessing. Exposing these
  atoms to Valdres States or scopes (interop) would break the attribution.
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

## Listener and lifecycle flush

Each mounted Jotai atom has one plain Valdres subscription,
`store.sub(state, callback)`. The callback runs in Valdres' notify phase, after
the commit, where Valdres forbids writes and dormant external reads; it does
neither and only records the mounted atom as changed. A `BufferFrame` also
records every atom a write's `set` changed, even when a later `set` restored
the committed value, because Valdres does not notify for a net-zero commit.

Every store method except `get` (`set`, `sub`, the returned unsubscribe, and an
async write's `set` after its `await`) runs inside a per-store operation frame.
When the operation's Valdres calls have returned, and so no Valdres transaction,
`settle` round or notify pass is active, the frame runs a port of Jotai's
`flushCallbacks`:

1. Collect the listeners of every changed atom into one `Set` and clear the
   changed set. A listener subscribed to several changed atoms runs once; an
   atom changed several times in one operation is recorded once.
2. Take the queued unmounts and mounts (from sentinel detach/attach).
3. Call the collected listeners. A listener removed by an earlier listener in
   the same round still runs (Jotai calls its snapshot too); one added runs from
   the next change.
4. Run `onUnmount` callbacks, then `onMount` callbacks, with a lifecycle buffer:
   `setAtom` calls they make synchronously are staged and committed together
   afterwards. A mount and an unmount of the same atom queued before either ran
   cancel out.
5. Repeat while steps 1–4 produced new changes, unmounts or mounts. There is no
   round limit, as in Jotai.
6. Run Suspense watchers (continuable promises).

Because listeners run outside every Valdres phase, Valdres' callback, `settle`
and transaction guards do not apply to them: they read committed values (the
same objects `store.get` returns), write, subscribe, unsubscribe and use other
stores. Selector callbacks keep Valdres' guards (G4).

**Reentrant writes.** A `store.set` from a listener is a complete nested
operation: it commits and runs its own flush before returning, so the listeners
of what it changed run inside the `set` call, as in Jotai, and the outer flush
continues with its own snapshot. A `store.set` inside a write function commits
the outer write's staged sets together with its own, then flushes. `setAtom`
called from `onMount`/`onUnmount` joins the lifecycle buffer; called later, it is
an ordinary operation.

**Errors.** Every listener, `onUnmount`, `onMount` and lifecycle commit is
called in isolation; its error is collected and the flush continues. After the
flush and watchers, the operation throws `AggregateError` of the collected
errors (or an `Error` with an `errors` array where `AggregateError` is missing),
replacing the operation's own result or error, as Jotai's flush does. A nested
operation's `AggregateError` propagates into the listener that called it and is
collected there. Writes made before a listener or write function threw stay
committed.

## Evidence beyond the upstream suite (`test/adapter/`)

Each scenario runs in-process against real Jotai and this package; traces must
be equal unless a difference is asserted on both sides.

- `listeners.test.tsx` (12): listener reads see the committed derived object
  that `store.get` returns; listener writes are visible immediately and notify
  inside the `set`; a write that changes and restores an atom notifies it; one
  listener on several changed atoms runs once; listeners may use other stores,
  subscribe (mounting immediately) and unsubscribe (unmounting); listeners
  removed or added during a round follow Jotai's snapshot; a nested
  subscription whose `onMount` throws and a throwing listener surface as
  nested `AggregateError`s; listener errors keep earlier writes; one write
  renders a component once with the final state.
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
- `previous.test.ts` (12): `selectAtom` keeps its previous slice per store,
  never across stores; a self-reading atom keeps identity across equal
  updates; the previous error is rethrown to the self-read (all equal to
  Jotai). Asserted differences: a value read inside a write after a `set`, eager
  recomputation advancing the previous value, a `set(self)` to the stored
  value. Cache ownership: a write that throws leaves only installed results; a
  staged read inside a write is not retained; caches are per store; atoms that
  never read themselves are not cached; cached values are released with their
  store or atom.
- `differential.test.ts`, `react.test.tsx`, `boundaries.test.ts`: writes,
  mounts, StrictMode lifecycle, Provider ownership, SSR and hydration, Suspense
  and error boundaries, and the explicit unsupported boundaries.
- `test/types/declarations.tsx`: type contract, also satisfied by Jotai's own
  types except the removed `signal`.
- `test/packed/`: prepacked tarballs installed with React 18.3.1 and 19.1.1 on
  Node and Bun, SSR, hydration, StrictMode, Suspense, the `development` export
  condition, and the packed declarations under `tsc` (NodeNext,
  `skipLibCheck: false`).

## Where each mismatch arises

The statement this evidence supports is narrow: each listed test reproduces
with Valdres v1 used through public APIs the way this adapter uses them, and
none fails because of the listener flush or the previous-result cache (their
suites match Jotai except the asserted differences). That does not show core
must change; several items are core policies the owner keeps. Core's
assessment found no confirmed core defect.

| Gap                                               | Known failures | Skipped | Where it arises                                                                                        |
| ------------------------------------------------- | -------------: | ------: | ------------------------------------------------------------------------------------------------------ |
| G1 `get()` after `await`                          |             26 |       1 | A selector's dependencies are recorded only while its getter runs; its `get` is revoked afterwards    |
| G2 `options.signal`                               |              7 |       0 | Aborting needs to know whether a store installed or discarded a result; evaluation phase does not say |
| G3 `INTERNAL_onInit`                              |              7 |       0 | No per-store hook that may write during a first read                                                   |
| G4 Store calls inside reads                       |              2 |       0 | Selector callbacks may not call Store methods; there is no untracked read inside a getter              |
| G6 `unwrap`                                       |              0 |      11 | G1 + G3                                                                                                |
| D1 eager recompute of unsubscribed derived atoms  |              3 |       0 | Core recomputes every live record of a changed dependency; a policy choice, undocumented either way   |
| D2 sibling `onMount` order                        |              1 |       0 | Siblings attach in reverse read order; a legacy fix (#253) not ported to v1 and not a v1 contract     |
| D3 stack overflow                                 |              1 |       0 | Core caches stack exhaustion as an ordinary error; detecting it here would need message matching      |
| D4 derived values read inside a write after a set |              — |       — | Transaction reads re-evaluate selectors (parked transaction-read work); tested in the adapter suites   |
| **Total**                                         |         **47** |  **12** |                                                                                                        |

G5 (previous-value self-read) is closed by the previous-result cache; its
remaining identity differences are executable tests, not listed upstream gaps.

**Not changed, by decision:** a `store.set` inside a read whose write function
only reads could reuse the evaluation's `get`, but those reads would become
tracked dependencies, unlike Jotai. Core policies D1 and D2 are out of scope
for this package (D2's fix is a separate, unapproved proposal at +42 B gzip).

## Late `get()` and `signal`: feasibility prototype (not integrated)

A bounded prototype (local branch `proto/jotai-async-reads`, worktree
`.context/proto-async`, from `9df1fa9d`) recorded, per store and atom, the
dependencies an async read function reads after it returned; after every store
operation it re-read them and, on a change, bumped a per-atom revision atom the
selector reads. Late dependencies of retained atoms were retained, and each
evaluation outside a discarded transaction owned an `AbortController`.

- **Would pass:** 33 of the 45 listed late-`get`, `signal` and `unwrap` tests
  (26 of 27 late-`get`, all 7 `signal`), and 9 of 11 async scenarios traced
  against Jotai. #3240 and all 11 `unwrap` tests still failed.
- **Why it is not integrated:** it is a second dependency mechanism (late
  edges, change detection by polling, invalidation and retention) beside
  Valdres'. Building it surfaced two synchronous infinite loops; polling
  compares values, not Jotai's change epochs; dynamically created async atoms
  stay retained by their store (Jotai collects them); every operation re-reads
  every watched dependency (0.084 ms vs Jotai's 0.0025 ms per unrelated `set`
  with 1,000 settled async atoms); every derived atom pays a sentinel and a
  revision atom (about 43 vs 28 ms per 10,000 sets on a mounted chain); and it
  rests on core behavior the assessment says is not a contract.
- **Missing capability:** a dependency read after a getter returned cannot be
  attached to the value the store installed:

  ```ts
  import { atom, selector, store } from "valdres"
  const source = atom(1)
  let capturedGet: ((state: typeof source) => number) | undefined
  const user = selector(get => {
      capturedGet = get
      return "installed"
  })
  const app = store()
  let notified = 0
  app.sub(user, () => notified++)
  try {
      capturedGet!(source)
  } catch (error) {
      console.log((error as { code?: string }).code) // VALDRES_SELECTOR_READ_REVOKED
  }
  app.set(source, 2)
  console.log(notified > 0) // false
  ```

  Closing it would mean core-owned dependency edges added after evaluation and
  bound to the installed evaluation, which reverses v1's synchronous model.
  Not requested.

## Other boundaries

- `onMount` assigned after a store already used the atom without one throws
  `VALDRES_JOTAI_ON_MOUNT_AFTER_FIRST_USE` (configs made by `jotai`'s own
  `atom()` always get a sentinel and accept it).
- Dependency cycles fail with `SelectorCircularDependencyError` instead of
  overflowing.
- `toString()` includes `debugLabel` in production builds too.

## Decisions recorded

- Previous computed values: integrated (adapter-only), differences documented.
- Late `get()`, `signal`, `unwrap`: unsupported, with explicit errors; the
  async prototype is preserved, not integrated. No new core primitives.
- No core eager/lazy policy change or sibling attachment-order fix here.
- No Valdres-state interop, exposed private Store, or `jotai/react/utils`.
- Release-ignored; no npm deprecation or publication.

## Review notes

The three mechanisms that carry the most risk, with what to check.

### Listener flush (`src/lib/runtime.ts`: `mount`, `run`, `flushCallbacks`)

- The only Valdres subscription per mounted atom records a change in Valdres'
  notify phase and does nothing else; Jotai listeners never run inside a
  Valdres transaction, `settle` round or notify pass.
- `run()` wraps every operation except `get`; its `finally` flushes and then
  rethrows collected errors as `AggregateError`, replacing the operation's own
  result or error (Jotai's behavior). Check that nested operations (a listener's
  `set`) flush before returning and that the outer snapshot continues.
- Net-zero writes rely on `BufferFrame` recording configs changed by any `set`.
- Evidence: `listeners.test.tsx` (12, equal to Jotai), upstream `store` and
  `onmount` files.

### Mount ownership (`src/lib/nodes.ts` `createLifecycle`, `src/lib/operationStack.ts`)

- A sentinel's attach/detach is attributed to the innermost operation frame.
  This is correct only under the adapter's isolation: one private root Valdres
  Store per Jotai store, no scopes, no invalidating ExternalAtoms in Jotai
  graphs, every Valdres call wrapped. Reached outside a frame, it throws
  `VALDRES_JOTAI_LIFECYCLE_OUTSIDE_OPERATION`.
- Mount events are applied in the flush after listeners: unmounts, then
  mounts; a mount and unmount queued before either ran cancel out.
- Evidence: `ownership.test.ts` (7, equal to Jotai, plus the no-fallback case),
  upstream `onmount`.

### Previous-result cache (`src/lib/nodes.ts` `evaluate`, `src/lib/runtime.ts` `previous`)

- Only atoms that read themselves are cached (`selfRead`), per store in a
  `WeakMap` keyed by atom; an entry holds the outcome and the stored value it
  was computed with.
- `readStaged` increments `speculative`, so evaluations inside a write's
  discarded transaction do not record. Every other evaluation under the
  adapter's isolation is one the store installs; this, too, rests on the
  isolation (core does discard evaluations elsewhere, for example in scopes or
  hydration, which this package does not use).
- `readCommitted` runs inside an operation frame so `get`-triggered evaluations
  are attributed to their store.
- Evidence: `previous.test.ts` (12) and the upstream `selectAtom`/`splitAtom`
  files.

## Running

```bash
bun run test:jotai          # both tsconfigs, adapter suite, upstream vs adapter and vs jotai@3.0.1
bun run test:jotai:packed   # tarballs, React 18 + 19, Node + Bun, SSR, hydration, dev condition, types
```

Both run in CI as the `jotai` job and in `bun run verify`. The job is not in
`publish`'s `needs`, and the package stays out of the publishable list.

**Performance**, informational (one run, median of 7, `NODE_ENV=production`,
loaded laptop): the adapter took 2–3.5x Jotai's time on micro-benchmarks (a
primitive set with a listener, a mounted 3-level derived chain, an unmounted
derived read after each set, a write atom with two sets). No budget is claimed.
