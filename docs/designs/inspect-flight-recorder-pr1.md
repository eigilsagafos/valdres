# Inspectable Store flight recorder — PR1 decisions

Status: implementation record for review. These choices are intentionally
reversible before the 1.0 API freeze.

## Goal

Make one StoreTree replaceable with an inspectable Store that preserves normal
Valdres behavior while exposing enough structural evidence to diagnose a cold
ShiftX interaction without changing the ordinary Store's retention or hot path.

```text
singleton public v1Domain
├── store()                   -> host(instrumentation = undefined)
└── createInspectableStore()  -> host(structural recorder)
                                 ├── same Atom/Selector ownership
                                 ├── same Store facade and semantics
                                 └── bounded pull-only report
```

## Selected choices

1. **Same-domain construction.** `valdres/inspect` creates a native StoreTree
   inside the singleton public domain. A proxy would miss evaluator work; a
   second domain would reject public State handles.
2. **Optional transaction label.** `store.txn(callback, name?)` accepts a human
   label on every Store. The normal Store ignores it. Opaque operation and
   commit IDs—not labels—provide correlation.
3. **Construction-time instrumentation.** A Store is ordinary or inspectable for
   its lifetime. Runtime attach/detach is excluded because it complicates
   ownership, partial histories, and the normal path.
4. **Two bounded rings.** Completed operation/commit/span summaries and detailed
   structural events overflow independently. Overflow is explicit; no raw State
   handles, callbacks, errors, or application values enter the report.
5. **Native structural schema.** The recorder uses Valdres operation, commit,
   evaluation, and cycle-search concepts. OpenTelemetry is a possible exporter,
   not a dependency or hot-path API.
6. **Separate traced cycle walker.** Normal Stores keep the existing branch-free
   DFS. Inspectable Stores select a traced equivalent once per search and emit
   one aggregate record, not one event per node visit.
7. **Subpath API.** PR1 exports only `valdres/inspect`; the root entry remains
   unchanged. PR2 may add `valdres-react/inspect`.

## Alternatives retained for review

- A standalone `@valdres/inspect` package remains possible, but a subpath keeps
  singleton-domain identity easier to certify and is sufficient before 1.0.
- Runtime attach/detach could reduce the need to swap a Store factory, but would
  make the trace incomplete by construction and introduce ordinary-host state.
- A callback/stream API could power live DevTools, but would permit reentrancy
  and make recorder failures participate in Store work. PR1 is pull-only.
- Lossless unbounded events would simplify analysis, but can retain an
  arbitrarily large graph interaction. Bounded capture plus complete aggregate
  summaries is the safer default.
- Eager value snapshots were considered. PR1 records structural identities and
  names only; PR2 can add explicit per-State serializers that never retain raw
  values.
- React Profiler correlation belongs in `valdres-react/inspect` so the ordinary
  hook bridge remains unchanged.

## PR boundary

PR1 includes the inspectable Store, synchronous spans, operation/commit IDs,
transaction labels, selector evaluations and proposed-topology details,
cycle-search aggregates, transient selector-host counts,
propagation/notification totals, JSON export, bounded overflow, packaging, and
normal-Store isolation gates. It deliberately does not claim publication events
or a complete scratch/hydration lifecycle trace.

`valdres/inspect` is an experimental, independent-beta diagnostic boundary. It
does not satisfy or restore the legacy snapshot, `onChange`, enumeration, or
DevTools APIs that remain assigned to the future inspection companion.

PR2 is limited to opt-in value serializers, React Profiler correlation, and an
optional post-capture OpenTelemetry exporter.

## PR1 isolation evidence

The final ordinary root/adapter consumer fixtures remain below their existing 2%
size ceilings; only the new `valdres/inspect` fixture adds a baseline. The
packed inspect consumer is 70,728 raw / 19,048 gzip bytes on Bun 1.4.0.

Two diagnostic comparisons used identical Bun-built `origin/main` and PR1
artifacts, Node 24.16, 100 alternating fresh-process pairs, zero warmups, and
semantic-oracle checks before timing:

- cold initial-view core: base p50/p95 9.173/11.397 ms; PR1 9.083/11.157 ms;
  paired median PR1/base ratio 1.010x;
- one 800-item transaction rewiring 400 entities: base p50/p95 38.381/46.470 ms;
  PR1 39.360/43.976 ms; paired median ratio 0.9998x, with PR1 faster in exactly
  50/100 pairs.

The mutation lane matched 4,710 reads, 4,710 notifications, and checksum
1,095,249,266 for every admitted sample. These are diagnostic parity results,
not an authoritative release benchmark; they show no directional ordinary-Store
regression from the construction-selected evaluator seam.
