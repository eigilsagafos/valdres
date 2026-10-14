# One bounded source/layout discrimination step

Declared after native matrix 38613401133, before these executions. Unchanged Bun source fixture failed at 5022.48 ms, with the same six-node component; all portable reductions collected. At t5084.222 the target collected in the first round after the runner reported timeout, before the test body completed. This is temporal correlation, not proof of runner ownership or an engine defect. Prior 34 valid processes and nine root-guard rejections remain preserved.

The portable actual-Valdres case changed both module loading (one common unminified bundle) and fixture layout (shared runCase function/branches/counters). Separate those variables; minimize from the failing file rather than treating the portable matrix as a proven reduction.

Budget: exactly 11 new fresh processes locally and 11 on native Linux x64, no retries:
- Original fixture body with only imports adjusted to the existing bundle (Bun and Node).
- Portable matrix body with only Bun's store import adjusted from bundle to unchanged source (Bun only).
- Original fixture body with a 35-line callback queue/retained batch handle replacing Store/transaction operations (Bun and Node).
- Original fixture body with direct queueMicrotask, no invocation wrapper/cursor (Bun and Node).
- Original fixture body with no callback creation/scheduling (Bun and Node).
- Deliberate global callback retention in the new queue fixture (Bun and Node).

Keep original 5000 ms test deadline, unchanged Bun detector, same Node adapter, original 3x50 limits, GC/snapshot/task sequence, and both capture-collection assertions. Removing Stores/cursors means removing their setup/disposal/count checks in direct/unscheduled reproductions, not changing any required repository gate. Queue case retains a two-handle assertion and clears both committed/aborted batches. This queue is reproduction code only, not a proposed scheduler.

Node fixture uses node:assert behind the same expect(...).toBe/toHaveLength expressions and node:test with an explicit 5000 ms option. Its adapter is extracted verbatim from the already-executed Node probe (no new GC or task steps). Positive controls must still fail and expose the known global retaining path. Do not repeat completed earlier cases, including the unchanged failing fixture. Save results even on failure. Parent process cap remains 20 s; a parent kill is reported separately from the 5000 ms assertion deadline.

One separate workflow dispatch on the diagnostic branch, with read-only permissions/no release. Fix only the post-test evidence-export shallow-checkout defect (fetch-depth: 0), preserving the first failed job/log/artifact. No rerun of its matrix. If all smaller cases collect, report non-reproduction and keep the original fixture as the smallest demonstrated reproducer; do not search more layouts for a preferred outcome.

## Evidence-based correction to the reduction, before native dispatch
The first local fixture-shaped queue failed on both engines. Node's saved path identifies an introduced owner: test generator -> cursors array -> handle.push -> dispatch lexical environments -> callback -> payload. Building push inside dispatch shares the outer callback environment. Actual Valdres constructs methods in a separate RootTransactionCursor constructor. This queue failure is not the original unexplained six-node component: Bun's complete reverse component has 25 nodes and includes retained handles/test frame (still no reported root). The initial queue negative control fails at aborted collection, so it does not validate the intended committed-only mutation. Preserve it, do not claim control success.
Add a second queue file that moves only handle allocation into makeHandle(batch), outside dispatch's callback scope. Preserve the first queue as a demonstrated shared-environment retention control. Exactly four additional fresh local processes and four additional native processes: factory queue normal and deliberate-retained-committed, on each engine. These are structural/cause-directed cases, not reruns. Native dispatch therefore has 15 new cases total; local completed 11 plus these four. No deadline/GC/assertion changes. All smaller normal cases collecting will remain non-reproduction of the original failure.
