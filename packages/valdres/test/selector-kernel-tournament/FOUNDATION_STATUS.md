# Selector-kernel tournament foundation v3

F0–F9 implementation is complete. Readiness is determined only by fresh sealed
v3 green, red, verification, and review artifacts plus an ancestry-preserving
main landing. This tracked document is not evidence that a run or landing passed.
No candidate implementation or shared/public kernel interface is introduced.

## Authority and execution

The reviewed Lansing tree is frozen as `frozenFoundationSha` before the final
run. Every final bundle must identify that same clean SHA. A tracked-byte fix
requires a new frozen SHA and a complete rerun of green, red, and verification.
The frozen base remains rooted at spec merge
`20dddc5c307a1213f3888ab0dabc60a59a165b36`; this branch does not merge moving main.

`foundationMergeSha` is a later main landing used only to distribute tooling.
It must preserve the frozen SHA as an ancestor; squash and rebase landing are
forbidden. Readiness checks foundation-owned tournament bytes at landing and
resolves frozen inputs from the original authority. Candidate branches must
start at the frozen SHA, and protected files compare against it. Recorded
invocation paths are evidence; validators read their own protected frozen bytes.

## Implemented work order

- F0: closed v3 manifest/report schemas, frozen hashes, source ceiling checks,
  protected paths, and exactly one empty non-release Changeset.
- F1: isolated source archives, separate normal production/counter packs,
  authenticated private adapters/builders, full installed-tree/import checks.
- F2: independent exhaustive 1–5-node graph closure, operation-boundary DAG
  evidence, exported error identity, stage-specific C/A contracts, deterministic
  differential traces, and the frozen independent family lane.
- F3: complete 17-workload corpus and fixed counters/checksums, preserving the
  ShiftX fixtures and all 900 no-writes lifecycle steps.
- F4: existing paired statistics with fixed 8/24/50 pairs, separate protected
  and intended hypotheses/BH families, p95 gates, explicit inconclusive results.
- F5: immutable plans, exact process/hash/sample evidence, raw power/thermal and
  competing-process inventory, closed report recomputation and readiness gates.
- F6: independent source absolute and packed paired memory domains, unchanged
  ceilings and package-size infrastructure, root-reachability checks.
- F7: complete beta.36-vs-beta.36 control runner, raw noise diagnostics without
  an intended-win obligation, immutable passing/failing bundle seals.
- F8: 14 failure classes with 20 explicit variants and 40 baseline/mutation
  processes. Added variants exercise intermediate graph state, exported cycle
  identity, equality-recovery notification, and both memory domains.
- F9: independent neutrality/statistics review artifacts and hashed dispositions,
  exact CI/test completeness checks, isolated publish dry-run and cleanup,
  final freeze, full verification, and landing handoff.

## Memory scope

The unchanged `architecture.memory.ts` runs all eight original Bun/Node scenarios
from source archives, retaining every original absolute ceiling. Global atom
and async disposal remain source regressions outside the selector rewrite.
Packed memory covers six scenarios, both runtimes, and five alternating pairs.
It blocks on retained head/control ratio above 1.10 and the original absolute
FIRST-release residual ceiling. All three later-drain observations are preserved
as diagnostics. Cold packed artifacts do not use source retained-byte ceilings.
At C, heap reports are diagnostic; qualification A and the control require both
memory domains. Family compatibility and core-load qualification remain A gates.

## Deterministic reproduction

From a clean frozen checkout with pinned Bun/Node and installed dependencies:

```sh
bun scripts/selector-kernel-tournament/inputs.mjs check
bun scripts/selector-kernel-tournament/control-bundle.mjs run NEW_RUN_ID
bun scripts/selector-kernel-tournament/red-bundle.mjs run GREEN_ROOT NEW_RED_ROOT
bun scripts/selector-kernel-tournament/verification.mjs run NEW_VERIFICATION_ROOT REVIEWS_ROOT
```

The verification runner executes `bun run verify` (all enabled repository CI
steps), all tournament self-tests, existing paired/robust statistic tests, frozen
family tests, exact direct-source Bun/Node memory tests, and the publish dry-run
in a disposable archive. Every raw process includes the exact argv/cwd and output.
The review bundle must be sealed, independently authored for both review roles,
and cover exactly the final frozen tree. Findings resolve to hashed artifacts.

Evidence root:
`~/.gstack/projects/eigilsagafos-valdres/selector-kernel-tournament/`.
Final green bundles use `<frozenFoundationSha>/beta36-control/1/<runId>/`.
Each bundle has a full `SHA256SUMS`; its digest is recorded by the successor
readiness/handoff artifact. Missing, stale, unknown, incomplete, or altered
artifacts cannot satisfy readiness. No candidate verdict follows from a review.

## Review dispositions and landing

The independent reviews found and drove fixes to C/A stage boundaries, process
competition detection, intermediate graph evidence/domain validation, exported
cycle-error identity, equality recovery assertions, exact F9 completeness and
hashed dispositions, chronological ShiftX gesture timing, and bimodal claim
handling. Final review artifacts record the reviewed tree and all dispositions.

The next permitted workspace is `selector-kernel-foundation-landing`. Its task
is to land this frozen authority with ancestry preserved, keep every
foundation-owned tournament byte, preserve upstream shared-manifest entries,
and create the foundation PR targeting main. The ordinary PR/Bencher and GitHub
Ubuntu checks remain landing checks; local verification runs on macOS arm64.
The landing workspace records the actual merge SHA and green/red/verification
seal digests in readiness evidence. Candidate work remains locked until F9
artifacts and the foundation merge are recorded and validated. Do not create a
candidate workspace, candidate PR, or family workspace from this handoff.

## Earlier immutable diagnostics

All earlier v1/v2 and development bundles remain preserved and are ineligible
for v3 readiness. Selected checkpoints under the shared evidence root:

- `ba9d0833ddff9c700e622db4fa9584ed5f051209/beta36-control/1/foundation-control-initial/`:
  SHA256SUMS `60d83dca4976cac014cdbe250a91847b0da178eefcd7ff8caab13b4df6783d56`.
- `foundation-development/v2-f6-complete-audit/`:
  SHA256SUMS `99efa5b1a48182ca6c2162d23a3e5c4af53e23a5735b0a0e823d4f36dd02e4c8`.
- `foundation-development/v2-f6-resource-red-reviewed/`:
  SHA256SUMS `1d5a5aae3d9aed2df65102f82bc04eba9a3e2eec6d7ea8e6ca1f276e25351b3a`.
- `foundation-development/v2-foundation-verification-6ed63687/`:
  SHA256SUMS `7f0a8993a0b531285022f19ec7c4846c4a704f7cedaf1ac232b726cf420b7d54`.
- `foundation-development/v3-domain-probe-c78d2633/`: failed parser probe,
  SHA256SUMS `c31a81899ce3ba3bb360f4dac4bc9f491c151e5833d7a80905199f24a9150753`.
- `foundation-development/v3-domain-probe-e5f0e807/`: 32 source rows pass,
  SHA256SUMS `dc5734e586dfb4de841aa78f35d3f19445be937df86ae8260830d2a9601d3012`.
- `foundation-development/v3-red-probe-initial/`: failed mode setup,
  SHA256SUMS `d43a3dd15fd04eaaf80b1f4c5a68c6d0263223682653caab7f5d3e8ae066700e`.
- `foundation-development/v3-red-probe-counter-mode/`: failed fixture setup,
  SHA256SUMS `257146995db70bd69d50146f85dc8d5c8adfb56ad4bef3d9db8c9fb511f35787`.
- `foundation-development/v3-red-probe-fixture/`: original 17 variants pass,
  SHA256SUMS `bd932fd867103a22f0c230271acfe6de4e9673e09e8b9bc560cd2fdc2f256594`.
- `foundation-development/v3-domain-probe-6124a1c0/`: 32 source rows pass,
  SHA256SUMS `ac785c2f1f84f587eb92166805206e3f7e5ad7b2f4879ee2cfddb4f7c052d71f`.

The post-review development red bundle `foundation-development/v3-red-probe-reviewed/`
passed all 20 variants (40 processes); its SHA256SUMS digest is
`79fe1e96c8a872a8a2e239ba8898244361f2ebcc8b0954a69611cdacae63d767`.

The earlier resource audit also fixed installed shared-chunk verification and
first-release observation selection. None of these changes modified production
source, existing tests, ceilings, versions, lockfiles, or public declarations.

A complete frozen attempt at `5b4cd42804f81a9abd8541bc480e412dae211ca6` produced
a passing green control and all passing red proofs, then exposed an F9 launcher
defect: ordinary repository tests inherited the production-artifact launcher's
`NODE_ENV=production`. F9 now records an explicit `env -u NODE_ENV` for ordinary
CI/test commands, while source-memory commands retain their required production
mode. A subprocess regression proves both modes; the self-test count is 78. This
tracked correction requires a new reviewed freeze and every final evidence
bundle to be rerun. The superseded attempt remains immutable under that SHA,
with these SHA256SUMS digests:

- Green `beta36-control/1/foundation-v3-final-20260905/`:
  `5486d2ff0701349ac09aca6ca16d0c299a81c981d83ffc2a02b80573d8acc82e`.
- Red `foundation-v3-final-red-20260905/`:
  `239e71fa2cdff615aa40141527a563543a28dccd705f1583cbbfc58d7af31056`.
- Failed verification `foundation-v3-final-verification-20260905/`:
  `eac9c36d720fb8a63d767a6377904f1f47567d5422d895552561dbd1a6204a2e`.
