# Retention snapshot capture (diagnostic only)

The two retention timeouts remain unresolved. This capture is not a fix and
must not be interpreted as evidence for a conservative-root cause.

Set `VALDRES_RETENTION_CAPTURE_DIR` to an absolute output directory. The normal
CI test job enables it without changing any test command, order, concurrency,
assertion, deadline, sleep, GC call or snapshot call. It keeps the **first and
latest existing Inspector-format snapshot for each affected test**, at most four
graphs in memory. The two files' `afterAll` hooks serialize and release those
graphs outside their timed assertions, including after a failed assertion or
runner timeout. No snapshot is taken if collection finishes in round zero.

Each export includes the snapshot phase, round and monotonic timestamp; up to
20,000 scalar phase lines (with a dropped-line count); target markers; Bun's full
revision and dependency versions; platform, architecture and command arguments.
CI separately records the actual Node executable's versions, checkout SHA,
run/attempt and kernel. Bun's `process.versions.node` is its compatibility value,
not the installed Node version. `always()` uploads both passing and failing
results, plus available JUnit reports, for 14 days. Download the artifact for
long-term preservation. A hard process kill cannot run `afterAll`; synchronous
phase lines still survive in the job log. Late async continuation after timeout
can update the latest snapshot: compare its timestamp with the timeout log.

Mutable callback payloads get a non-enumerable property pointing **outward** to
a shared empty marker. No diagnostic structure points back to the payload.
Frozen collection rows stay unchanged: the capture retains only their primitive
string keys. Matching incoming `key` edges produces candidates and can be
ambiguous across domains. Neither mechanism stores a callback, detector,
WeakRef or tested object. The snapshots themselves contain scalar graph data.

This is not timing-neutral: property marking changes payload shape; retaining
snapshot arrays and phase strings changes memory pressure and allocation; extra
function calls add work. Serialization and file I/O happen after the assertions.
The negative controls check both retained-after-release and prematurely-released
objects; a passing ordinary run is non-reproduction, not resolution.

Offline analysis (no GC or live-object access):

```sh
python3 packages/test/diagnostics/analyze-retention.py /path/to/downloaded/capture
```

The analyzer writes `analysis.json` with target/candidate node IDs, near incoming
edges and bounded paths to the snapshot's reported root. It analyzes only the
first 20 sorted candidate IDs per target/snapshot; compare `candidateCount` with
the number of returned candidates for that limit. It searches at most 20,000
nodes and 32 edges in depth per candidate and reports traversal truncation.
**No reported root does not
mean no root**: this JSC format can omit conservative-root edges. Scalar-key
candidate counts are not identity guarantees. Raw graphs remain available for
further offline analysis.

To demonstrate capture from a failure, run a copied maintained test with only a
deliberate owner added; assertions and deadlines are unchanged:

```sh
VALDRES_RETENTION_CAPTURE_DIR=/tmp/retained-control \
  python3 packages/test/diagnostics/retention-control.py retained-committed
# The preceding command must exit nonzero. Then inspect its saved evidence:
python3 packages/test/diagnostics/analyze-retention.py /tmp/retained-control \
  --require-control-path
```

The original committed-capture assertion must reject the global control holder.
The saved graph must show `__valdresDeliberatelyRetainedCommitCallback` leading
through the callback's lexical environment to the marked payload. The control
also accepts `retained-present`, `retained-absent`, `premature-present` and
`premature-absent`. These copied fixtures live outside normal suite selection,
are saved with their exact patch and command, and are removed after execution.
The separate manual-only negative-control workflow intentionally has a failing
job and uploads its artifacts anyway. It cannot publish and does not run during
normal PR or main CI. Its original native failure and saved retaining path are
preserved in [the diagnostic run](https://github.com/eigilsagafos/valdres/actions/runs/38579814544).

If a normal failure's graphs still cannot establish a retaining path, the next
proposal is one bounded fresh-process comparison: the affected test alone
versus the same ordered prefix that preceded it, with the same capture,
assertions and deadlines. A later observer can check reachability after the test
frame unwinds without changing the assertion. This would test process/test-frame
interference before considering native-engine work; it is not an automatic retry.
