# Packed core-load benchmark

This harness measures the ShiftX-shaped render/read → subscribe → unsubscribe →
remount workload that exposed the beta.23 graph regression. It is deliberately
separate from the existing per-operation Mitata suite:

- each timing sample runs once in its own fresh Node process;
- package import and graph construction happen before the timer;
- there are zero workload warmup processes;
- the timed window begins before initial render/subscription and ends after all
  900 update/scroll steps, before final unmount;
- every sample must match frozen semantic checksums and exact public-work counts
  before its latency is admitted;
- results retain every unrounded `performance.now()` sample, the ordinary
  median, and nearest-rank p95;
- timing, full-oracle, and counter-instrumented runs are separate modes.

The only runnable implementation target is an npm-style packed `valdres` ESM
tarball whose production root export resolves inside `dist/`. The checked-in
adapter must live in `adapters/`. Paths into `test/v1-model` or another
reference model cannot be selected. The beta.23 package is a
historical/current-beta control; its numbers are never labeled v1 core
performance and relative speedup never replaces the v1 absolute gate.

## Self-test

From `packages/valdres`:

```sh
bun run test:core-load-harness
```

The test proves, among other protocol invariants, that `no-writes` still
performs 900 scroll steps. It has 43,350 subscriptions and 43,200 timed
unsubscriptions, while both write counters and notifications remain zero.
Setting the number of steps/writes to zero is not an allowed no-write control.
It also packs the v1 runtime and runs three fresh Node timing processes per
scenario under deliberately broad Linux-CI catastrophic ceilings (2.5 seconds
for writes, 750 milliseconds for no-writes). Those smoke ceilings prevent the
legacy multi-second regression from returning; they do not replace the pinned
Mac runner's authoritative 10/15 millisecond release target.

## Diagnostic current-beta baseline

```sh
bun run bench:core-load -- \
  --baseline-tarball /absolute/path/to/valdres-1.0.0-beta.23.tgz \
  --samples 5
```

This runs both `writes` and `no-writes`. A run with fewer than 50 samples, a
dirty worktree, a non-designated runner, or no candidate is explicitly
diagnostic and cannot produce a passing or failing release-gate result.

The frozen semantic values were derived only from the archived packed beta.23
artifact with this provenance:

- package: `valdres@1.0.0-beta.23`
- tarball SHA-256:
  `d98638aa0d8890d35f25b2a132fb7add0355206f925fcf2a4cfe0104a20cafa4`
- production root-entry SHA-256:
  `d3dbc827209cd553232bb5cb52ecb245f5fb07387df560b9cb08f80a2e434ffb`
- extracted `dist` tree SHA-256:
  `029f97486a585629a5ea094656bc463065bb7cde5ec0be938702e7c666d64c3b`

The runner re-hashes the supplied tarball, production entry, full `dist` tree,
fixture, adapter, and harness. It also records the package version/git head,
Node/V8, OS build, hardware, power/thermal observations, repository commit and
dirty status, invocation, and export conditions. Unknown historical build flags,
bundler, or minifier are reported as unknown rather than inferred.

## Full semantic oracle

Run the untimed SHA-256 trace separately:

```sh
bun run bench:core-load -- \
  --baseline-tarball /absolute/path/to/valdres-1.0.0-beta.23.tgz \
  --mode oracle
```

The oracle includes ordered public reads, notification order, and selected final
values. It also drains a microtask and macrotask and rejects deferred public
notifications. It never supplies a latency sample.

## Compare a future v1 candidate

The `v1` adapter normalizes the approved public spelling (`store()`,
`scope(id)`, `get`, `set`, `update`, and `sub`) without importing production
source. Compare two independently packed artifacts with alternating process
order:

```sh
bun run bench:core-load -- \
  --baseline-tarball /absolute/path/to/valdres-1.0.0-beta.23.tgz \
  --candidate-tarball /absolute/path/to/valdres-v1-candidate.tgz \
  --candidate-build-metadata /absolute/path/to/build-metadata.json \
  --samples 5
```

Candidate build metadata has this shape:

```json
{
    "gitSha": "40-character-source-commit",
    "buildCommand": "NODE_ENV=production bun run build",
    "bundler": "exact tool and version",
    "minifier": "exact tool and version, or explicit none",
    "flags": ["every non-default build flag"]
}
```

Diagnostic output reports candidate-to-beta ratios for context, but evaluates no
gate. The authoritative command adds `--authoritative`, uses at least 50
samples, and must run both scenarios on the pinned clean AC-powered Mac17,4 /
Apple M5 / 32 GiB / Node 24.16.0 / macOS 26.5.2 runner:

```sh
bun run bench:core-load -- \
  --baseline-tarball /absolute/path/to/valdres-1.0.0-beta.23.tgz \
  --candidate-tarball /absolute/path/to/valdres-v1-candidate.tgz \
  --candidate-build-metadata /absolute/path/to/build-metadata.json \
  --samples 50 \
  --authoritative
```

Only the candidate is checked against the absolute `<=10.0 ms` p50 and
`<=15.0 ms` p95 ceilings. The beta control is not a threshold.

Authoritative mode accepts only the exact checked-in `fixture.v1.json` path and
frozen file SHA-256, semantic checksums, and oracle trace digests. `--fixture`
may select an experimental fixture for a diagnostic run, but never for a release
gate. Before starting any timing process, authoritative mode also runs one
fresh, untimed full-oracle process for every target/scenario pair, validates it,
records the evidence ahead of the timing results, and links every timing sample
to that evidence ID.

The candidate metadata `gitSha` must equal the clean benchmark repository HEAD.
When the packed package contains `gitHead`, it must equal that same commit. This
prevents a clean harness checkout from blessing an artifact built from different
source.

## Internal work counters

Counter runs are untimed and use a separately instrumented packed v1 artifact:

```sh
bun run bench:core-load -- \
  --baseline-tarball /absolute/path/to/valdres-1.0.0-beta.23.tgz \
  --candidate-tarball /absolute/path/to/valdres-v1-counter-build.tgz \
  --mode counters
```

The instrumented candidate installs an object at
`Symbol.for("valdres.test.coreCounters.v1")` before the adapter is created. It
must expose synchronous `reset()` and `snapshot()` functions. `snapshot()` must
return all canonical counters named in `fixture.v1.json`. For `no-writes`, the
runner requires zero subscription-caused re-evaluations, validation walks,
reverse-edge installs/removals, orphan walks, and lifecycle-edge visits.
Legitimate first materializations are reported separately. An instrumented
artifact is rejected in timed mode.

The counter reset must return synchronously and must not be thenable. Every
canonical counter must be zero immediately afterward. The runner also compares
all canonical counters across the post-unmount microtask/macrotask drain and the
post-dispose drain; any delta is rejected as hidden graph work.
