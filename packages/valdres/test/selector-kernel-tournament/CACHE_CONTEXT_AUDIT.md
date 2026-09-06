# Semantic evidence cache and invocation authority

This document describes validator rules, not a passing tournament verdict.
Recorded artifacts and gates alone determine readiness. `globalAtom` remains
outside the rewrite, and frozen family compatibility remains non-scoring.

## Confirmed defect and reproduction

The former `validateSemanticEvidence()` cache used only the relative evidence
path and its SHA-256. A repeated reference returned before checking the later
caller's artifact, observation mode, installed files, or invocation context.
Report and timing admission share this cache across arms.

The independent reproducer and the unchanged frozen validator demonstrated
that a warm cache accepted wrong Git/tarball identities and counter mode while
the same calls with an empty cache failed. The repository regression additionally
demonstrated twelve bypassed context/byte checks before the fix. Its positive
case first validates a complete protocol fixture through the real validator,
then proves identical-context reuse. It does not mock the validator or oracle.
The fixture contains no selector implementation and is never scoring evidence.

Before-fix artifacts are immutable under the shared evidence root:

- `foundation-cache-amendment/before-178f6f38-20260905`
- `foundation-cache-amendment/regression-before-178f6f38-20260905`
- `foundation-cache-amendment/review-findings-before-29a7a397-20260905`

Each has `SHA256SUMS`, exact reproducer source and raw results. Later handoffs
record their digests together with fresh control, red and verification evidence.

## Cache context and checks

The semantic cache key is a canonical encoding of:

| Input | Binding |
|---|---|
| Evidence root | Absolute resolved root and the supplied invocation root |
| Evidence path | Absolute validated path |
| Evidence bytes | SHA-256 of the exact bytes parsed |
| Observation | Explicit public/counter mode |
| Expected artifact | Complete expected metadata object, including Git SHA, tarball SHA and all installed-package hashes |
| Recorded invocation | The `recordedRoot()` value for the current call |

A cache hit occurs only after revalidating the evidence schema, complete embedded
artifact identity, frozen inputs, compiled worker, raw-file hashes, process
records, argv, cwd, stdout, installed package manifests/entries/chunks, row
inventory and replay summaries. Only the expensive raw oracle analysis is
reused. A changed referenced file fails even when the top-level evidence file
and caller context are unchanged. The full embedded artifact object must equal
the authenticated expected artifact; unknown or contradictory echo fields fail.

Preflight groups rows by evidence path and observation mode within one fixed
root/artifact invocation. It calls the validator once per group and checks every
declared trace row. These groups store row references, not reusable verdicts.

## Broad cache and early-return audit

The complete source searches are retained as process evidence. Reproduce with:

```sh
rg -n '\b(cache|compiled|expectedWrapper|WeakMap|WeakSet)\b|\.has\([^\n]+\).*return|return [^\n]*\.get\(' scripts/selector-kernel-tournament --glob '*.mjs'
rg -n '\breturn\b' scripts/selector-kernel-tournament --glob '*.mjs'
```

| Site | Disposition |
|---|---|
| Semantic evidence result cache | Fixed as described above; private synchronous callers do not mutate cached results |
| Report/timing/preflight cache callers | Shared arms remain supported; all caller context reaches the semantic validator |
| Compiled worker cache | Caches expected build output from the fixed frozen module graph; every supplied worker is still hashed and compared on each call |
| Generated wrapper cache | Caches deterministic output from frozen code and authenticated historical inputs; every runner still verifies wrapper bytes, inputs and installed artifact |
| Schema compilation | Fixed normative schemas loaded from the authenticated frozen authority |
| Root-reachability visited set | Local to one traversal; prevents repeated traversal, with no reuse across evidence contexts |
| Observer identity/host/facade maps | Per-observation normalization state, reset between cases; not admission verdicts |
| Graph, workload and statistics maps | Local algorithm state or grouping, not cross-context validator caches |

Build/schema/wrapper caches rely on the enforced clean, fixed authority lifetime.
They are not reusable across an edited source checkout; the outer tournament
drivers and readiness validator authenticate the frozen authority. Recorded
paths never supply the validator's own source or dependencies.

## Additional authority findings and corrections

The required broad review also reproduced unbound red/F9 authority roots,
source-memory/family working directories, and embedded artifact echo fields.

- Red and F9 roots must equal the invocation root from the already authenticated
  green provenance. Frozen readiness passes that expected root explicitly; a
  proof cannot choose its own expected authority. Red process cwd is exact.
- Source-memory extraction uses a deterministic disposable directory derived
  from the evidence root and arm: `source-memory/<arm>-source`. The recorded cwd
  must be its `packages/valdres` directory. Archive, full source snapshot and
  frozen harness checks remain required. The temporary source is removed after
  collection; its deterministic recorded path remains bound to the archive.
- Semantic, workload, core-load, packed-memory, size, family and environment
  process records check the exact working directory used by their collectors.
  This retains Bun/configuration lookup context as well as explicit argv.
- Complete embedded semantic artifact equality rejects unknown fields and
  contradictory copies of installed-file identities.

The source-memory regression uses a real authenticated source archive and
synthetic protocol measurements; it is not a memory result. Fresh F7/F9 execute
the unchanged real harness under Bun and Node.

## Red inventory and frozen policy

F8 contains 14 classes, 22 variants and 44 baseline/mutation outcomes. The two
new provenance-mismatch variants, `semantic-cache-identity` and
`semantic-cache-mode`, warm the shared cache with real fresh control evidence,
record the warmup and submission, and require the mismatched submission to exit
at `SEMANTIC-EVIDENCE-IDENTITY`. Each has an unchanged passing baseline that
proves identical-context reuse.

This amendment changes no estimator, threshold, sample protocol, blocking
policy, timing description, memory ceiling, semantic expectation or family
contract. All historical timing/calibration failures remain in their sealed
bundles. Fresh evidence reports its own complete results without replacing
historical observations. No candidate workspace follows until the amended
foundation is sealed and its actual main landing satisfies readiness.
