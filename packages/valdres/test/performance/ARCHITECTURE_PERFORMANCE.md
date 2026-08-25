# Architecture performance gates

These gates measure Valdres graph scheduling and commit architecture.
Deterministic structural counts are the blocking signal; end-to-end latency and
retained heap are confirmation signals. Index construction and indexing are
explicitly out of scope.

## Commands

From `packages/valdres`:

```sh
bun run test:architecture
ARCHITECTURE_REPORT=1 bun run test:architecture
bun run test:memory:bun
bun run test:memory:node
bun run test:bench
bun run test:bench:node
```

The normal Bun test suite also discovers `architecturePerformance.test.ts`. CI
runs the deterministic gates and both retained-memory lanes explicitly. The
existing benchmark commands continue to run the full timing suite under Bun and
Node; `architecture.timing.ts` adds matching end-to-end confirmation scenarios.
The architecture timing scenarios run in a separate process after the existing
suite, then append to the same result file. This keeps the legacy base/head
measurements under identical JIT and GC history when the scenarios exist only on
one side of a PR comparison.

## Counter definitions

- `selectorEvaluations`: selector bodies entered, including committed and
  transaction-overlay reads.
- `selectorSettlements`: selector evaluations requested by propagation.
- `duplicateSelectorSettlements`: a second or later propagation settlement of
  the same `(store, selector)` in one measured logical commit.
- `affectedStoresSettled`: unique stores with at least one dirty selector pass.
- `storeSettlementPasses`: all dirty-selector passes.
- `duplicateStoreSettlements`: second or later dirty-selector pass for the same
  store in one measured logical commit.
- `dependencyEdgeVisits`: forward/reverse selector graph edges examined by the
  propagation scheduler. Subscription dispatch, scope-tree edges, and liveness
  reconciliation are deliberately excluded.
- `schedulerQueueEnqueues` / `schedulerQueueDequeues`: ready/resweep selector
  queue work where a queue exists. The one-selector linear fast path correctly
  reports zero.
- `schedulerWorkAllocations`: scheduler-owned `Map`/`Set`/array containers
  created inside the measured window. Warm graph commits should reuse their
  frame-local workspace and report zero.
- `livenessWorkAllocations`: liveness/mount-owned work containers created inside
  the window. Warm multi-container cyclic/reconciliation walks reuse their
  workspace; the mount walks remain local and still report their short-lived
  containers. The live/not-live count walks allocate their traversal array only
  when a dependency genuinely flips and the walk has to cascade past the root's
  own edges, so churn that resolves at the root reports zero for them.
- `schedulerCycleFallbacks`: stalled cyclic regions settled by the isolated
  insertion-order fallback. Ordinary acyclic graphs must report zero.
- `livenessEdgeVisits` / `mountEdgeVisits`: dependency edges examined by
  liveness reconciliation and mount/unmount closure walks, respectively.
- `mountTransitions` / `unmountTransitions`: successful lifecycle state
  transitions. These distinguish allocation savings from skipped lifecycle work.
- `commitPlanRuns`: admitted `runCommitPlan` executions. Every single-store
  transaction commit shape (ordinary, hooked, cleanup) must execute exactly one
  plan; scalar direct writes correctly report zero. A resolved timer tick also
  admits exactly one plan for value plus metadata-off. Its earlier metadata-on
  and optional pending-value publications retain their distinct observable
  commit boundaries through direct propagation, so this counter deliberately
  does not equal the number of `onCommitEnd` callbacks for that async lifecycle.
- `cacheMetaAllocations`: public cache-metadata snapshots created in the window.
  One resolved timer tick creates exactly two cheap immutable literals: the
  revalidating snapshot and the idle snapshot published after settlement.
- `cacheStatePeeks`: cache-sidecar lookups. A cold max-age read performs exactly
  one lookup and threads that entry through stale eviction.
- `globalStoreListCopies`: snapshots of a global atom's attached stores. Timer
  metadata walks the live set because its internal equality/write phase cannot
  re-enter; pending SWR promise publication is likewise identity-only. A
  resolved user value retains one snapshot for fan-out semantics.
- `commitPlanAllocations`: plan-graph containers — settlements, forest entries
  and entry lists, global effects, descriptor queues — built through
  `lib/commitPlans.ts` inside the window. A scalar write (no plan at all), a
  hooked direct write, and a hook-free transaction commit all report zero: the
  hook-free bulk shape reuses one module-static plan graph. A direct global
  write reports exactly `6` — ONE `[atom, value, origin]` descriptor and ONE
  queue, shared by the ordered global sets and the deferred onSet queue because
  they describe the same write, plus the forest entry, its list, the global
  effects, and the settlement. A plan object built as an inline literal at a
  call site is outside this count. Like `assertPlanLegal`, this counter is an
  engine self-check and is compiled out of the published bundle.

The collector is an internal optional `StoreData` field. It is attached only for
one synchronous test/benchmark window, inherited by scopes created during that
window, and removed in `finally`. Normal stores never create the collector; the
instrumentation is disabled outside tests/benchmarks and is not public API.

## Deterministic baseline

Baseline recaptured on 2026-07-29 from `b85d858d` (`origin/main`) before the
worklist rewrite, then updated to the optimized gates. Columns are evaluations,
settlements, duplicate settlements, unique stores, store passes, duplicate store
passes, edge visits, enqueues, and dequeues.

| Scenario                            | Eval | Settle | Dup sel | Stores | Passes | Dup store | Edges | Enq | Deq |
| ----------------------------------- | ---: | -----: | ------: | -----: | -----: | --------: | ----: | --: | --: |
| Atom-only write                     |    0 |      0 |       0 |      0 |      0 |         0 |     0 |   0 |   0 |
| Live fan-out, width 8               |    8 |      8 |       0 |      1 |      1 |         0 |     8 |   0 |   0 |
| Unchanged multi-seed closure, 200   |    2 |      2 |       0 |      1 |      1 |         0 |     4 |   0 |   0 |
| Asymmetric DAG, depth 6             |    7 |      7 |       0 |      1 |      1 |         0 |    40 |   8 |   8 |
| Dynamic churn, width 6              |    6 |      6 |       0 |      1 |      1 |         0 |     6 |   0 |   0 |
| Single-store update + delete        |    1 |      1 |       0 |      1 |      1 |         0 |     3 |   0 |   0 |
| Cross-scope transaction, depth 3    |    1 |      1 |       0 |      1 |      1 |         0 |     3 |   0 |   0 |
| Cross-scope update + delete + unset |    1 |      1 |       0 |      1 |      1 |         0 |     4 |   0 |   0 |
| Cross-scope txn, plan/peer overlap  |    1 |      1 |       0 |      1 |      1 |         0 |     2 |   0 |   0 |
| Global fan-out, width 6             |    6 |      6 |       0 |      6 |      6 |         0 |     6 |   0 |   0 |

The allocation instrumentation captured these before/after deterministic
results. Every "after" row is measured after one warm commit so container
creation, rather than logical queue work, is isolated.

| Scenario                | Scheduler allocs before | Scheduler allocs after | Liveness allocs before | Liveness allocs after |
| ----------------------- | ----------------------: | ---------------------: | ---------------------: | --------------------: |
| Live fan-out, width 8   |                       5 |                      0 |                      0 |                     0 |
| Asymmetric DAG, depth 6 |                      12 |                      0 |                      0 |                     0 |
| Dynamic churn, width 6  |                       5 |                      0 |                      2 |                     2 |
| Dynamic mount churn     |                       2 |                      0 |                      6 |                     6 |

The unchanged multi-seed gate has two dirty selectors over a 200-node downstream
chain whose values remain equal. It requires the write to stop after four edge
visits rather than discovering all 200 descendants. Leaf fan-out and churn stay
off the graph workspace entirely. The re-entrant mount-write gate warms nested
scheduler frames, then requires a write during `onMount` to produce final inner
and outer values with zero new scheduler containers.

The cyclic-closure gate requires the insertion-order fallback to iterate to the
stable `9 / 9` fixpoint. Value-divergent cycles retain a bounded settlement
budget before cycle-closing signals are suppressed; this prevents the
synchronous scheduler from running forever without truncating practical
convergent cycles.

Pooling the single-array live-count walks, and later the mount/unmount closure
walks, reduced deterministic allocation counts but regressed at least one
runtime. Those paths deliberately keep their measured-faster local containers.
Only the multi-container cyclic DFS and exact reconciliation paths retain pooled
liveness storage.

Selector/store counts that express current commit behavior are exact. Edge and
queue gates allow narrow structural headroom: 0–25% for linear shapes and 37–42
visits for the asymmetric DAG. Queue enqueues must equal dequeues. These are
engine-independent algorithm counts, not JavaScript object-layout or nanosecond
assertions. The rows record the proven-safe deduplication this table previously
anticipated: the commit-forest CommitPlan (`settleCommitForest`) visits each
affected store once with the union of its own and inherited triggers, so the
depth-3 cross-scope spanning selector dropped from three evaluations (one per
reaching ancestor pass) to one, with zero duplicate settlements; the mixed-kind
row proves the union spans update, delete, and unset triggers; and the
plan/peer-overlap row proves a global peer that is itself a plan store folds
into that single settlement instead of also running a separate peer pass. A
non-global single-store transaction with cleanup mutations is the same
settlement's one-entry case, so the update-plus-delete row is now `1` selector
evaluation with zero duplicates — the duplicate detectors are kept honest by the
direct positive control instead, which reports the same store and the same
(store, selector) pair twice inside one measured window. Transaction commits
carrying cleanup mutations (with or without global peers, single-store or
cross-scope) additionally gate on exactly one `commitPlanRuns`. Lowering
baselines further requires the same proven-safe standard; increasing them
requires review.

## Retained-memory methodology and baseline

Each scenario runs three independent trials and gates the median. For every
trial the harness:

1. drains two microtask turns and one macrotask;
2. performs three explicit full collections, with micro/macro settling between
   collections;
3. records retained heap while the scenario is strongly reachable;
4. disposes/detaches/cancels it, drops the harness references, repeats settling
   and GC, then records the remaining delta.

Bun uses `bun:jsc` full GC and `heapSize + extraMemorySize`. Node runs with
`--expose-gc` and uses `process.memoryUsage().heapUsed`. The async-disposal case
also asserts every evaluation signal is live before disposal and aborted after
disposal. These are retained-heap leak/regression gates, not total-allocation or
RSS measurements.

Observed medians below are bytes per retained unit from an interleaved local
base/head comparison on Bun 1.3.14 and Node 24.16.0. Benchmark CI now pins Bun
1.4.0, where the suite still passes under every ceiling — medians shift slightly
downward (e.g. single-store transactions 232 → 149 B/unit) from JSC heap-layout
changes, so these 1.3.14 baselines stand as valid upper references pending a
deliberate recalibration. Ceilings are runtime-specific because the heaps
differ, but are normalized per scenario unit and leave roughly 25–30% above the
observed median.
Released heap has a fixed ceiling: 512 KiB on Bun and 256 KiB on Node.

Calibration note (single-store transactions, Bun): JSC's
`heapSize + extraMemorySize` is sensitive to the byte layout of the commit
engine module — adding a never-called function to a pristine `commitEngine.ts`
alone moved this scenario 157 → 229 B/unit while the Node/V8 lane stayed at 85
B/unit. The Bun observed/ceiling values therefore absorb code-layout shifts (360
still detects a real per-transaction pin such as a retained MutationDraft, ~+220
B/unit here); the Node lane is the layout-insensitive cross-check.

| Scenario                            | Units | Bun base → head B/unit | Bun ceiling | Node base → head B/unit | Node ceiling |
| ----------------------------------- | ----: | ---------------------: | ----------: | ----------------------: | -----------: |
| Atom-only stores                    | 4,000 |              111 → 111 |         160 |                 84 → 84 |          120 |
| Live selector graphs                | 1,500 |          1,866 → 1,858 |       2,400 |           1,169 → 1,169 |        1,500 |
| Dynamic dependency churn            | 1,000 |          1,608 → 1,610 |       2,100 |           1,174 → 1,157 |        1,400 |
| Scope creation and disposal         | 1,500 |          2,459 → 2,459 |       3,200 |           2,668 → 2,668 |        3,400 |
| Single-store transactions           | 2,500 |              232 → 232 |         360 |                 85 → 85 |          120 |
| Deep cross-scope transactions       |    64 |        23,063 → 23,117 |      30,000 |         10,603 → 10,603 |       14,000 |
| Global fan-out                      | 1,000 |          2,920 → 2,921 |       3,700 |           2,763 → 2,763 |        3,400 |
| Store disposal + async cancellation |   500 |          5,887 → 5,890 |       7,500 |           5,885 → 5,886 |        7,500 |

The largest released-heap medians after disposal were 247,344 B on Bun and
68,752 B on Node, below their 512 KiB and 256 KiB gates.

## Timing confirmation baseline

Three interleaved base/head pairs were run locally against `b85d858d` after the
final fast-path and liveness decisions. The table reports only directly affected
shapes, avoiding performance claims from unrelated machine drift. Atom-only uses
five additional interleaved pairs because nanosecond rounding dominates three
samples.

| Scenario                                       |  Bun base → head | Node base → head |
| ---------------------------------------------- | ---------------: | ---------------: |
| Atom-only set                                  |       47 → 48 ns |     125 → 127 ns |
| Live graph fan-out 100                         |   28.5 → 23.9 µs |   33.0 → 28.1 µs |
| Unchanged multi-seed closure 200               |     578 → 503 ns |     737 → 677 ns |
| Dependency churn 100                           |   49.2 → 43.8 µs |   72.5 → 64.0 µs |
| Subscribe/unsubscribe 100 shared pairs         | 176.5 → 176.7 µs | 331.0 → 335.1 µs |
| Subscribe/unsubscribe + fan-in                 | 177.4 → 181.1 µs | 337.8 → 338.0 µs |
| Subscribe/unsubscribe + fan-in + mounted spine | 481.8 → 484.1 µs | 638.6 → 661.4 µs |

Selector scheduling targets improve on both engines; atom-only remains flat and
all three teardown medians remain within the 5% non-regression limit. The paired
PR model is authoritative for its protected family: it runs balanced B-P-P-B
blocks on one runner and blocks statistically supported regressions over the
+10% budget. The smallest of the first three head/base ratios remains a +50%
catastrophic backstop (see `scripts/PAIRED_DECISION_MODEL.md`).

## Limitations

- Instrumentation is disabled, rather than compiled away, on normal stores; the
  Node/Bun end-to-end lanes confirm the inactive checks in the real hot paths.
- Scheduler edge counts intentionally exclude selector `get`, subscription
  callback, mount/liveness walk, and scope-tree traversal; liveness and mount
  edges have their own counters.
- Microtask scheduling is counted only where Valdres owns a selector work queue.
  Host runtime queue internals and async timing are not asserted.
- Explicit GC reduces noise but cannot make heap layout portable.
  Median-of-three, per-unit ceilings, and post-disposal leak ceilings avoid
  pinning engine object sizes or requiring a particular valid internal
  representation.
- Global atoms include process-wide state. Scenarios dispose every temporary
  request store; the permanent global store itself is not disposable.
- Timing numbers are confirmation data, not fixed local pass/fail thresholds.
