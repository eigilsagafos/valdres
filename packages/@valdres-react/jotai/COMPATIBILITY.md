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

The statement this evidence supports is narrow: each of the 49 listed gaps
reproduces with Valdres v1 used through public APIs the way this adapter uses
them, and none of the listed tests fails because of the listener flush (the
listener and ownership suites match Jotai). That does not show core must
change. A mismatch may still be closable in the adapter (see the async and
previous-value feasibility notes), and several are core policies the owner may
keep. Core's assessment found no confirmed core defect.

| Gap                                                     | Tests | Where it arises                                                                                         |
| ------------------------------------------------------- | ----: | ------------------------------------------------------------------------------------------------------- |
| G1 `get()` after `await`                                |    27 | A selector's dependencies are recorded only while its getter runs; its `get` is revoked afterwards     |
| G2 `options.signal`                                     |     7 | Aborting needs to know whether a store installed or discarded a result; evaluation phase does not say  |
| G3 `INTERNAL_onInit`                                    |     7 | No per-store hook that may write during a first read                                                    |
| G4 Store calls inside reads                             |     2 | Selector callbacks may not call Store methods; there is no untracked read inside a getter               |
| G5 previous-value self-read (`selectAtom`, `splitAtom`) |     2 | A selector reading itself is a cycle, which latches even when caught                                     |
| G6 `unwrap`                                             |    11 | G1 + G3 + G5                                                                                            |
| D1 eager recompute of unsubscribed derived atoms        |     3 | Core recomputes every live record of a changed dependency; a policy choice, undocumented either way    |
| D2 sibling `onMount` order                              |     1 | Siblings attach in reverse read order; a legacy fix (#253) not ported to v1 and not a v1 contract      |
| D3 stack overflow                                       |     1 | Core caches stack exhaustion as an ordinary error; detecting it here would need message matching       |
| D4 derived values read inside a write after a set       |     — | Transaction reads re-evaluate selectors (parked transaction-read work)                                  |

**Eliminated without core changes in the previous revision:** listeners reading
recomputed derived values, listener writes notifying only after the listener
returned, net-zero writes not notifying, a listener on two atoms running twice,
cross-store calls from listeners failing (`TransactionPhaseError`), and
deferred listener (un)subscription. All came from running listeners as `settle`
handlers, which core's docs also advise against for re-entrant work. Adding
`useAtomValueRaw`/`RawSync` passed 3 former `not-applicable` tests and 14 more
upstream tests.

**Not changed, by decision:** a `store.set` inside a read whose write function
only reads could reuse the evaluation's `get`, but those reads would become
tracked dependencies, unlike Jotai.

**Separate, unapproved core proposal:** attaching siblings in read order (D2).
Core prototyped it: read order is restored and all runtime tests pass, but it
costs +42 B gzip on a zero-headroom size budget. Not part of this PR.

## Feasibility: async reads and previous values (prototypes, not integrated)

Two bounded prototypes on local branches from this head (`9df1fa9d`), outside
the candidate. Numbers are against the same 364-test upstream suite.

### B. Previous computed values (`selectAtom`, `splitAtom`)

Jotai keeps one value slot per atom and store, written by both reads and sets;
a derived atom with `init` reading itself gets that slot. The prototype keeps,
per store, the last installed outcome (value or error) of atoms that read
themselves, and returns it while the atom's stored value (init or last `set`) is
unchanged since that outcome; otherwise the stored value. The stored value stays
a Valdres dependency. No selector reads itself, so no core cycle is involved.

- **Passes:** both previous-value gaps (`selectAtom` "do not update unless
  equality function says value has changed", `splitAtom` "no unnecessary
  updates when updating atoms"), with no regressions (364 = 305 pass, 47 gaps,
  12 skipped). 7 new differential tests: per-store isolation, identity across
  equal updates and the previous error rethrown to the self-read match Jotai.
- **Ownership:** a `WeakMap` per store keyed by atom, released with the store
  or the atom (both tested). Outcomes from discarded transaction reads (a
  write's read after a `set`) are not recorded.
- **Limitations (asserted against Jotai):** a value read inside a write after a
  `set` is recomputed for the store, so its identity differs (the
  transaction-read re-evaluation); eager recomputation of an unsubscribed atom
  advances its previous value between reads; a `set(self)` to a value equal to
  the stored one is not seen as a write.
- **Cost:** about 70 lines; no measurable change on a mounted derived chain.
  Relies on the same per-store operation attribution as `onMount`.
- **`unwrap`:** still fails. It also needs `get()` after promise settlement and
  `INTERNAL_onInit`.

### A. `get()` after `await` and `signal`

The prototype records, per store and atom, the dependencies an async read
function reads after it returned; after every store operation it re-reads them
and, on a change, bumps a per-atom revision atom that the selector reads, so the
store recomputes it. A retained atom keeps its late dependencies retained
(Jotai mounts them). Each evaluation outside a discarded transaction owns an
`AbortController`, aborted when a new evaluation in that store replaces its
unsettled promise.

- **Passes:** 33 of the 45 listed late-`get`, `signal` and `unwrap` tests (26 of
  27 late-`get`, all 7 `signal`), and 9 of 11 new async scenarios traced
  against Jotai (late dependencies mounted, unmounted-settled and pending;
  dependency replacement; abort on replacement but not on unsubscribe; stale
  completion; unmount/remount; rejection; a bounded late cycle).
- **Still failing:** #3240 (a captured `get` called inside another atom's read)
  and all 11 `unwrap` tests.
- **Divergences:** a write's read of an async atom after a `set` runs the read
  function twice (once discarded); that discarded evaluation's signal is never
  aborted and its late reads are untracked.
- **Lifecycle risks found while building it:** two synchronous infinite loops
  (a late read failing on the selector capability guard; a dependency failing
  with a fresh error object each read), both needing special cases. Polling
  compares values, not Jotai's change epochs: a dependency that changes and
  changes back between operations is missed, and a dependency that fails
  differently is treated as unchanged.
- **Resources:** the per-store records are a strong map, so an async atom created
  dynamically (for example by a family) that read a late dependency stays
  retained by its store; Jotai collects it (tested). Every operation re-reads
  every watched late dependency: with 1,000 settled async atoms an unrelated
  `set` took about 0.084 ms against Jotai's 0.0025 ms, growing linearly. Every
  derived atom gains a sentinel and a revision atom: a mounted 3-level derived
  chain took about 43 ms per 10,000 sets against the candidate's 28 ms
  (informational, one machine).
- **Size:** about 245 lines, and it relies on core behavior the assessment says
  is not a contract (no discarded evaluations outside the adapter's own
  transaction reads, attach/detach timing).

**Assessment:** this is a second dependency mechanism (late edges, change
detection by polling, invalidation and retention propagation) maintained beside
Valdres', with known semantic gaps. It is not proportionate for a compatibility
layer.

**Smallest concrete missing capability:** a dependency read after a getter
returned cannot be attached to the value the store installed, so Valdres never
recomputes it when that dependency changes:

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
console.log(notified > 0) // false: no way to add `source` to the installed value
```

Closing it in core would mean dependency edges added after evaluation, bound to
the evaluation the Store tree installed (rejected for discarded or replaced
evaluations), with core-owned invalidation and retention. That reverses v1's
synchronous dependency model and is a design decision for the owner, not a
request.

### Recommendation

- **B:** integrable as an adapter-only addition if the owner accepts its
  documented limitations; it is small and owns no state beyond Jotai's own
  per-atom slot.
- **A:** do not integrate. Keep late `get` and `signal` as an explicitly
  bounded subset (`VALDRES_JOTAI_LATE_GET`, `VALDRES_JOTAI_SIGNAL_UNSUPPORTED`),
  or take the core design decision above.
- **`unwrap`:** stays unsupported either way.

## Other boundaries

- `onMount` assigned after a store already used the atom without one throws
  `VALDRES_JOTAI_ON_MOUNT_AFTER_FIRST_USE` (configs made by `jotai`'s own
  `atom()` always get a sentinel and accept it).
- Dependency cycles fail with `SelectorCircularDependencyError` instead of
  overflowing.
- `toString()` includes `debugLabel` in production builds too.

## Decisions for the owner

- **Signal and late `get`:** keep throwing (recommended; the adapter-only
  prototype is not proportionate) or decide on core-owned late dependency
  edges. Core advises against exposing evaluation phase or store-specific
  invalidation.
- **Previous values:** integrate prototype B (adapter-only) or keep the two
  `selectAtom`/`splitAtom` gaps.
- **Promises as values:** keep boxing (adapter-only, invisible to core), or
  reject async atoms outright.
- **Core policies** behind D1–D4, and the D2 fix with its size allowance.
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

On the CI-pinned toolchain (Node 24.16.0, Bun 1.4.0), at `9df1fa9d`: `bun run
verify` passed all 28 steps without a toolchain override; the package's tests,
both upstream runs and the packed consumer passed. One `typecheck:tests` run
reported a spurious `TS2307` for `jotai-reference` (the known tsgo
multi-threaded resolution race); four reruns, including `--singleThreaded`,
were clean.

**Performance**, informational (one run, median of 7, `NODE_ENV=production`,
loaded laptop): the adapter took 2–3.5x Jotai's time on micro-benchmarks (a
primitive set with a listener, a mounted 3-level derived chain, an unmounted
derived read after each set, a write atom with two sets). No budget is claimed.
