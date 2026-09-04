# Foundation implementation status

The initial checkout matched the required specification merge exactly:
`20dddc5c307a1213f3888ab0dabc60a59a165b36`.

This is incomplete foundation work, not an eligible tournament report. No
candidate implementation, public kernel interface, candidate workspace, winner,
or promotion decision exists. The beta.36 runtime tree remains
`35a20a12ff1087140b08622f9057c857900d17e5`.

| Work order | Status                                                                                                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F0         | v2 authority implemented: 30 semantic cases, 17 workloads, six memory scenarios, 12 memory rows. Empty non-release Changeset retained.                                                                                                            |
| F1         | Shipping pack driver, separate counter-marker build, installed Node/Bun probes, and reviewed admission restrictions implemented. Actual control observation is implemented as a build-only plugin.                                                |
| F2         | Complete: all 30 cases, 740,951 edge attempts per replay, public/counter Node/Bun double replays, 58 frozen family tests, and 11 semantic red mutations verified.                                                                                 |
| F3         | Complete: 17 workloads and 31 runtime rows checked in timed/counter modes; frozen counts, checksums, timer windows, and 900-step no-writes lifecycle retained.                                                                                    |
| F4         | Complete: separate protected/intended hypotheses, fixed 8/24/50 pairs, deterministic calibration, and live Node/Bun A/A checks.                                                                                                                   |
| F5         | Complete: sealed evidence, independent raw recomputation, exact process/build provenance, immutable intent, stage prerequisites, 55 self-tests, fresh timed/counter metadata checks, three core oracle preflights, and 31 counter rows validated. |
| F6         | Resource executors remain outstanding; resource evidence validation fails closed until their required workers and raw observations exist.                                                                                                         |
| F7         | No green control bundle yet. Admission probes are not conformance or eligibility evidence.                                                                                                                                                        |
| F8         | No complete red proof bundle yet.                                                                                                                                                                                                                 |
| F9         | Final neutrality/statistics review and foundation PR remain outstanding.                                                                                                                                                                          |

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
