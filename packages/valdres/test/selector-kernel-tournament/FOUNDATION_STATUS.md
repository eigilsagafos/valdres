# Foundation implementation status

The initial checkout matched the required specification merge exactly:
`20dddc5c307a1213f3888ab0dabc60a59a165b36`.

This is incomplete foundation work, not an eligible tournament report. No
candidate implementation, public kernel interface, candidate workspace, winner,
or promotion decision exists. The beta.36 runtime tree remains
`35a20a12ff1087140b08622f9057c857900d17e5`.

| Work order | Status                                                                                                                                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F0         | v2 authority implemented: 30 semantic cases, 17 workloads, six memory scenarios, 12 memory rows. Empty non-release Changeset retained.                                                                                                                                                     |
| F1         | Shipping pack driver, separate counter-marker build, installed Node/Bun probes, and reviewed admission restrictions implemented. Actual control observation is implemented as a build-only plugin.                                                                                         |
| F2         | Complete: all 30 cases, 740,951 edge attempts per replay, public/counter Node/Bun double replays, 58 frozen family tests, and 11 semantic red mutations verified.                                                                                                                          |
| F3         | Complete: 17 workloads and 31 runtime rows checked in timed/counter modes; frozen counts, checksums, timer windows, and 900-step no-writes lifecycle retained.                                                                                                                             |
| F4         | Complete: separate protected/intended hypotheses, fixed 8/24/50 pairs, deterministic calibration, and live Node/Bun A/A checks.                                                                                                                                                            |
| F5         | Complete: sealed evidence, independent raw recomputation, exact process/build provenance, immutable intent, stage prerequisites, 55 self-tests, fresh timed/counter metadata checks, three core oracle preflights, and 31 counter rows validated.                                          |
| F6         | Complete: frozen six-scenario Bun/Node executor, paired memory decisions, 38 size metrics, root reachability, and both real packed resource red proofs. The control audit exposes six absolute-ceiling failures and a post-release monotonic failure; F7 remains blocked on those defects. |
| F7         | Full control run recorded all public/counter semantics, 58 frozen family tests, 31 counter rows, 1,900 timing processes, and size evidence. C/A A/A and all size metrics pass. Memory fails; no green bundle.                                                                              |
| F8         | No complete red proof bundle yet.                                                                                                                                                                                                                                                          |
| F9         | Final neutrality/statistics review and foundation PR remain outstanding. F6 independent review found two defects; both are fixed and independently re-audited. Repository verification, publish dry-run, memory regressions, and self-tests pass; final F9 still waits on F7/F8.           |

## Resolved normative defects

The user authorized the v2 correction in the 2026-09-04 continuation:

1. Native async settlement, supersession, cancellation, `Store.onChange`, and
   `Store.onCommitEnd` are outside shipped v1. The three async lanes are
   removed. `A-FAULT-001` requires synchronous returned/thrown thenable failure,
   rejection containment, and no settlement into State.
2. Global atoms are outside shipped v1; `M-GLOBAL-FANOUT` is removed. The frozen
   legacy memory source and its global/async regression tests remain unchanged.
3. Hydration reads valid same-domain State in a disposable selector host.
   Synthetic missing-server-reader behavior is removed from tournament
   authority.
4. Active-cycle blame belongs to `P`, with raw path starting/ending at `D`.
   Indirect public reads preserve the getter/dependency/circular cause chain.

The complete admission audit also reproduced two unambiguous factual details:

- Cached cycle and prefix rejection uses the other closed-path rotation,
  starting at `P`. Explicit traces preserve the raw error. The invariant
  validator rotates that path to `D`, preserving every edge and blame, before
  causal validation.
- Public callbacks cannot redefine nodes or inject nested Store publications as
  the evaluator TestHost can. The fresh-session lane uses the reachable Store
  settlement trace; the finalization lane checks the shipped callback
  quarantine. Synthetic evaluator tests remain unchanged repository regressions.

All 53 remaining lanes have public root/adapter operation mappings. The
admission probe exercises all 30 semantic mappings, 14 synthetic workload
cardinalities, and six memory construction/release topologies under Node and
Bun. The remaining three core-load lanes run the unchanged existing packed
runner in oracle mode under Node, including all 900 no-writes steps. This proves
executability and scope, not completion of the full semantic, timing, or memory
gates. See [ADMISSION_AUDIT.md](ADMISSION_AUDIT.md).

## Reproduction

Run input and self-test checks from a clean checkout:

```sh
bun scripts/selector-kernel-tournament/inputs.mjs check
bun scripts/selector-kernel-tournament/inputs.mjs protected
cd packages/valdres
bun run test:selector-kernel-tournament
```

Pack into a new, nonexistent absolute directory at the shared evidence root:

```sh
bun scripts/selector-kernel-tournament/artifact.mjs pack \
  1c03f126ba714d0765c3386e613f4c892b89829b /absolute/new-control timed
bun scripts/selector-kernel-tournament/artifact.mjs smoke /absolute/new-control
```

Repeat with a different directory and `counter` for the separate marker build.
Both commands reject output reuse. These are shipping artifact checks, not
latency measurements. The smoke verifies the resolved production entry and its
hash, including root/adapter singleton compatibility.

To reproduce the contract facts, copy
`scripts/selector-kernel-tournament/control-contract-probe.mjs` into either
installed `consumer-node` or `consumer-bun` directory, then run that file with
the corresponding runtime. It outputs diagnostics and never a conformance or
eligibility pass.

Development artifacts and the diagnostic bundle live under:

```text
~/.gstack/projects/eigilsagafos-valdres/selector-kernel-tournament/foundation-development/
```

This path is explicitly outside the authoritative candidate-run layout. No
candidate workspace is permitted next; this foundation workspace must first
finish F0–F9, record green/red proofs, and have its PR merged.

## F6 resource evidence

The complete diagnostic audit preserves 120 fresh memory processes. Beta.36
exceeds retained ceilings for atoms, single-store transactions, and deep
transactions under both runtimes. All 38 packed-size metrics pass. No ceiling or
frozen source was changed. This audit has no eligibility authority:

- Development directory: `v2-f6-complete-audit/`
- `SHA256SUMS` SHA-256:
  `99efa5b1a48182ca6c2162d23a3e5c4af53e23a5735b0a0e823d4f36dd02e4c8`

The sampler records three empty calibrations without State/Store operations to
isolate its own initialization, then retains the existing three scored samples.
Each release drain uses their process-level median residual. The fresh
`v2-f6-probe-median/` run still fails `MEMORY-MONOTONIC-LEAK` for Bun dependency
churn (262,478, 279,040, 279,216 bytes). The gate remains blocking.

The two F6 resource adversaries each pass with the intact control and fail only
at their intended gate after mutation. Retaining a real selector and its 2 MiB
payload fails `MEMORY-ABSOLUTE`; a root import into evidence code fails
`ARTIFACT-SOURCE-IMPORT` after recomputing tarball/dist hashes.

- Development directory: `v2-f6-resource-red/`
- `SHA256SUMS` SHA-256:
  `837a0f304eb10d03793e64a2174e5fdb2d9de0f41fcac1594c235e3af517f630`
- Reproduction:
  `bun scripts/selector-kernel-tournament/resource-red-worker.mjs ID TIMED_ARTIFACT_DIRECTORY NEW_ABSOLUTE_OUTPUT baseline`
  (then a separate output with `mutation`); IDs are `retained-memory-leak` and
  `root-bundle-leakage`. Mutation exit status must be 1 at the named gate.

These are F6 development proofs, not the complete F8 bundle linked to a green
control. The requirement to publish a green control and the requirement to
retain blocking resource ceilings are unresolved. No candidate admission is
permitted.

## Reviewed F6 corrections and F7 attempt

Independent read-only review found two concrete F6 defects, both fixed in
`6ed63687641d8d598aec364b1e663547fffb04ea` and re-audited:

- Installed identity now binds the package manifest, production entry, and
  complete dist tree before each memory/workload/semantic/core process and
  during evidence recomputation. A real packed workload accepted an altered
  shared chunk before the fix and rejects `ARTIFACT-INSTALL-HASH` afterward.
- The absolute release ceiling uses the original first-drain observation. That
  drain already performs three full GCs. Later drains remain observable for
  growth detection and cannot rescue the frozen first-drain ceiling.

The fresh F6 resource proofs at `v2-f6-resource-red-reviewed/` pass both intact
baselines and fail both mutations at their intended gates. `SHA256SUMS` SHA-256:
`1d5a5aae3d9aed2df65102f82bc04eba9a3e2eec6d7ea8e6ca1f276e25351b3a`.

The full F7 command is:

```sh
bun scripts/selector-kernel-tournament/control-bundle.mjs run NEW_RUN_ID
```

It preserves a failed run and exits nonzero. The first complete attempt recorded
all semantic replays, family compatibility, core oracle preflights, 31 counter
rows, 256 C timing processes, 1,644 A timing processes, and 38 size metrics.
Both timing stages passed their A/A non-regression and p95 decisions without an
intended-win requirement. Memory stopped at
`MEMORY-MONOTONIC-LEAK: M-DYNAMIC-DEPENDENCY-CHURN`.

Its immutable directory under the shared root is:

```text
ba9d0833ddff9c700e622db4fa9584ed5f051209/beta36-control/1/foundation-control-initial/
```

`SHA256SUMS` SHA-256:
`60d83dca4976cac014cdbe250a91847b0da178eefcd7ff8caab13b4df6783d56`. This is
failed evidence, predates the two reviewed corrections, and is not a green
bundle or a candidate-admission prerequisite.

Fresh verification after the corrections:

| Command                                                                                                              | Result                                                                                            |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `bun run verify`                                                                                                     | 19 enabled CI-equivalent steps pass; core/React/contracts/types/package/packed consumers included |
| `DRY_RUN=1 bash scripts/ci-publish.sh` in an isolated archive                                                        | pass; every package manifest restored, no backup files                                            |
| `bun run test:memory:bun` in `packages/valdres`                                                                      | 8 pass, unchanged legacy lanes                                                                    |
| `bun run test:memory:node` in `packages/valdres`                                                                     | 8 pass, unchanged legacy lanes                                                                    |
| `bun test test/selector-kernel-tournament` in `packages/valdres`                                                     | 63 pass, 148,855 assertions                                                                       |
| `VALDRES_ALLOW_ROOT_BUN_TEST=1 bun test scripts/lib/paired-decision*.test.ts scripts/lib/robust-estimators*.test.ts` | 67 pass, 490 assertions                                                                           |
| `bun scripts/selector-kernel-tournament/inputs.mjs check`                                                            | pass                                                                                              |

These are macOS development results. The Ubuntu CI run and the separate Bencher
PR measurement gate are not recorded as passed. The trusted benchmark change
classifier returns `true`; its full measurement remains required at F9.

## Upstream frozen-input conflict

While this branch retained its required base, `origin/main` advanced to
`0d101389a7a97a7e75533ced957333cb286d2aa4` through the collection PRs. It
changed these inputs frozen by this tournament:

- `scripts/size-baseline.json`
- `scripts/check-package-size.ts`
- `packages/valdres/src/v1-internal/family.ts`
- `packages/valdres/test/v1-public-candidate/family.test.ts`
- `packages/valdres/test/v1-public-candidate/family-cache.test.ts`

A read-only merge preview also reports a package-script conflict. No merge or
rebase was performed. Adopting upstream requires an explicit authority decision
for the frozen family, size, public-surface, and runtime substrate; silently
replacing those inputs would violate the current work order. This is separate
from the unresolved control-memory policy. F8/F9 and the PR remain pending.
