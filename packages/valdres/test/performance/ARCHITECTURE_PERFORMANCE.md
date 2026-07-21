# Architecture performance gates

These gates measure the current Valdres architecture without changing it.
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
- `commitPlanRuns`: admitted `runCommitPlan` executions. Every single-store
  transaction commit shape (ordinary, hooked, cleanup) must execute exactly
  one plan; scalar direct writes correctly report zero.

The collector is an internal optional `StoreData` field. It is attached only for
one synchronous test/benchmark window, inherited by scopes created during that
window, and removed in `finally`. Normal stores never create the collector; the
instrumentation is disabled outside tests/benchmarks and is not public API.

## Deterministic baseline

Baseline captured on 2026-07-20 from `origin/main` plus measurement-only
changes. Columns are evaluations, settlements, duplicate settlements, unique
stores, store passes, duplicate store passes, edge visits, enqueues, and
dequeues.

| Scenario                         | Eval | Settle | Dup sel | Stores | Passes | Dup store | Edges | Enq | Deq |
| -------------------------------- | ---: | -----: | ------: | -----: | -----: | --------: | ----: | --: | --: |
| Atom-only write                  |    0 |      0 |       0 |      0 |      0 |         0 |     0 |   0 |   0 |
| Live fan-out, width 8            |    8 |      8 |       0 |      1 |      1 |         0 |    16 |   8 |   8 |
| Asymmetric DAG, depth 6          |    8 |      8 |       1 |      1 |      1 |         0 |    43 |   8 |   8 |
| Dynamic churn, width 6           |    6 |      6 |       0 |      1 |      1 |         0 |    18 |   6 |   6 |
| Single-store update + delete     |    2 |      2 |       1 |      1 |      2 |         1 |     3 |   0 |   0 |
| Cross-scope transaction, depth 3 |    3 |      3 |       2 |      1 |      3 |         2 |     3 |   0 |   0 |
| Global fan-out, width 6          |    6 |      6 |       0 |      6 |      6 |         0 |     6 |   0 |   0 |

Selector/store counts that express current commit behavior are exact. Edge and
queue gates allow narrow structural headroom: 0–25% for linear shapes and
approximately ±16% for the asymmetric DAG. Queue enqueues must equal dequeues.
These are engine-independent algorithm counts, not JavaScript object-layout or
nanosecond assertions. The update-plus-delete case deliberately reaches the same
selector twice and proves both duplicate detectors are live. A future
proven-safe deduplication may lower these baselines, but increasing them
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

Observed medians below are bytes per retained unit from repeated local runs on
Bun 1.3.14 and Node 24.16.0; benchmark CI pins the same versions. Ceilings are
runtime-specific because the heaps differ, but are normalized per scenario unit
and leave roughly 25–30% above the observed median. Released heap has a fixed
ceiling: 512 KiB on Bun and 256 KiB on Node.

| Scenario                            | Units | Bun B/unit | Bun ceiling | Node B/unit | Node ceiling |
| ----------------------------------- | ----: | ---------: | ----------: | ----------: | -----------: |
| Atom-only stores                    | 4,000 |        111 |         160 |          84 |          120 |
| Live selector graphs                | 1,500 |      1,873 |       2,400 |       1,169 |        1,500 |
| Dynamic dependency churn            | 1,000 |      1,581 |       2,100 |       1,179 |        1,400 |
| Scope creation and disposal         | 1,500 |      2,474 |       3,200 |       2,668 |        3,400 |
| Single-store transactions           | 2,500 |        157 |         200 |          82 |          120 |
| Deep cross-scope transactions       |    64 |     22,949 |      30,000 |      10,569 |       14,000 |
| Global fan-out                      | 1,000 |      2,870 |       3,700 |       2,629 |        3,400 |
| Store disposal + async cancellation |   500 |      5,834 |       7,500 |       5,889 |        7,500 |

## Timing confirmation baseline

Single-run diagnostic p50s from the same machine are below. CI's existing
Bencher workflow remains authoritative: it runs base and head on the same runner
three times and compares the cross-run median, avoiding fixed nanosecond gates.

| Scenario                            |  Bun p50 | Node p50 |
| ----------------------------------- | -------: | -------: |
| Atom-only set                       |    78 ns |   332 ns |
| Live graph fan-out 100              |  57.3 µs |  87.3 µs |
| Dependency churn 100                | 120.2 µs | 142.0 µs |
| Create + dispose scope              |   542 ns |   1.3 µs |
| Single-store transaction, 20 writes |   6.7 µs |   8.5 µs |
| Cross-scope transaction, depth 8    |  36.9 µs |  42.0 µs |
| Global fan-out 100                  |  26.6 µs |  36.9 µs |
| Dispose pending selector            |   3.5 µs |   6.7 µs |

## Limitations

- Instrumentation is disabled, rather than compiled away, on normal stores; the
  Node/Bun end-to-end lanes confirm the inactive checks in the real hot paths.
- Edge counts intentionally cover propagation scheduling, not every selector
  `get`, subscription callback, mount/liveness walk, or scope-tree traversal.
- Microtask scheduling is counted only where Valdres owns a selector work queue.
  Host runtime queue internals and async timing are not asserted.
- Explicit GC reduces noise but cannot make heap layout portable.
  Median-of-three, per-unit ceilings, and post-disposal leak ceilings avoid
  pinning engine object sizes or requiring a particular valid internal
  representation.
- Global atoms include process-wide state. Scenarios dispose every temporary
  request store; the permanent global store itself is not disposable.
- Timing numbers are confirmation data, not fixed local pass/fail thresholds.
