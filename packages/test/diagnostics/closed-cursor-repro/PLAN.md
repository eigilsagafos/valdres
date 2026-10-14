# Bounded source-level reduction (declared before execution)

Frozen baseline: 348c943f4a3c73fca170de766776aed4b471c344. Preserve PR #445, its failed isolation mitigation, all native evidence and all earlier manifests. This packet is reproduction-only: no merges, production/gate changes or publication.

Hypothesis to distinguish: the visible six-node component is the synchronous transaction invocation wrapper, not the drained onCommit queue. Inspect all outgoing graph edges and source before reductions. No reported root is not no root. The snapshots lack function source locations and can omit conservative/native roots.

Fixed first-stage budget: 34 fresh processes, no retries.
- Once on local Darwin arm64, once on native Ubuntu 22.04 x64: unchanged isolated closed-cursors.test.ts on pinned Bun 1.4.0 (2 processes).
- At each location: four reductions x two retention modes x Bun 1.4.0 / Node 24.16.0 (32 processes).
- Modes: normal release; deliberate global retention of the committed callback (or object for the no-callback case). Controls must fail the same collection assertion or original 5000 ms test deadline, with target/path evidence; classify unrelated errors separately.
- Stages: actual Valdres onCommit with retained cursors; small queue with synchronous callback/cursor wrapper and retained queue handle; direct queueMicrotask; object released without callbacks. Keep abort/release and committed target pair. The queue has no Stores/transactions; the later stages remove the synchronous invocation wrapper explicitly.
- Both engines use the same unminified Bun-generated production bundle for the comparable Valdres case. The unchanged Bun fixture remains the source-graph/runner anchor. Do not equate bundle success with source-graph success.
- Every case has a 5000 ms assertion deadline, at most 3 x 50 collection rounds, initial 5 ms task gap, initial per-attempt task gap, two GC calls per round, snapshot after round 0, task between live polls. Bun uses the unchanged detector, ClearKeptObjects and Inspector snapshots. Node uses --expose-gc, task-boundary WeakRef clearing and synchronous V8 writeHeapSnapshot (including disk I/O); report that API/cost difference. Node's host GC behavior is not JSC's.
- First/latest snapshots only, existing round snapshots only. No post-case GC/snapshots, no live targets in logging/capture state. Serialization outside Bun's assertion. The no-scheduling normal case controls observation retention; positive controls provide known global roots.
- Parent 20-second process cap protects artifact writing/test-runner cleanup; it does not extend the 5000 ms test deadline. Run every predeclared case, record exit/signal/elapsed/exact command, even when another case fails. No automatic reruns.
- One native read-only workflow dispatch on a new diagnostic branch; no PR or publication job. Upload evidence with always().

Analysis: compare source functions/lexical environments where names/structure permit; analyze every retained target offline. A non-Valdres reproduction supports a harness/engine-boundary investigation, not an engine-bug claim. If only Valdres reproduces, perform source-level reduction only if a specific next discriminating change and bounded extension are declared first; do not launch a timing search. Non-reproduction is inconclusive. No engine-gate switch or fix without demonstrated defect.
