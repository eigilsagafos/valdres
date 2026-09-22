# Selector-kernel ShiftX research sidecar

> **Status: retired (historical record).** This sidecar and the
> `scripts/selector-kernel-tournament/` runner it wrapped were removed together
> with the rest of the selector-kernel tournament machinery; see
> [`selector-kernel-tournament.md`](./selector-kernel-tournament.md). The
> implementation is preserved in Git history. The ShiftX product gate that
> remains active is the packed core-load harness in
> `packages/valdres/test/performance/core-load/`, run by CI as
> `test:core-load-harness`.

Status: retired; formerly non-promotional research tooling.

This sidecar compares the three preserved selector-kernel implementations in
ShiftX without changing canonical tournament qualification. It admits only the
recorded source revisions and diff hashes for `incumbent-lite`,
`reactive-currentness`, and `dynamic-topological`. Contract C provenance and all
public semantic cases must have passed under Bun and Node. Prior Contract C
timing, p95, memory, and size outcomes are retained as diagnostics and do not
control research admission. The wrapper verifies the candidate's exact preserved
Contract C bundle seal and current canonical report schema before accepting
those facts. It does not recompute historical evidence against a later
foundation checkout.

`runShiftxResearch` in `scripts/selector-kernel-tournament/shiftx-research.mjs`
calls the existing `validateShiftx` implementation. Consequently the frozen
application/browser plan, paired schedule, process isolation, checksums, console
errors, traces, profile timelines, paired estimator, intervals, and p95 rules
are not forked. A failed or inconclusive protected comparison is a valid
completed research result.

The report records the original source commit and diff, common replay base,
replay commit and its independently hashed diff, clean package build and entry,
public smoke, pre-recorded three-candidate execution order, ShiftX application
build, browser, correctness checksums, result rows, decision history, and raw
profile references. Candidate and beta.36 entry identities are derived from the
existing packed-artifact validator before ShiftX evidence is accepted. Its
report boundary markers are always:

```json
{
    "kind": "shiftx-research",
    "promotional": false
}
```

The pinned Contract C execution identity is recorded separately from the
original source identity. They are equal for two candidates; dynamic-topological
used an earlier clean replay commit with the same preserved candidate diff.

Each replay is exactly one commit on the externally supplied common base. Git
proves that replay identity and diff; because the evolved base does not accept
the historical patches byte-for-byte, equivalence to the preserved source change
rests on the authenticated, trusted first-party replay review recorded with both
identities. This lane deliberately does not claim a static proof of semantic
patch equivalence. The runner validates the supplied base within each report;
the operator must supply the same base to all three runs and confirm the three
recorded base hashes match before comparing them.

The candidate object contains only an ID. There is no candidate stage, selection
object, machine eligibility, machine verdict, or human promotion decision.
Focused tests prove that the canonical candidate schema, report recomputation,
and prior-stage validator reject this research-only shape.

After this tooling lands, replay each preserved diff unchanged onto one common
research base, rerun Contract C public semantics and the ShiftX smoke, then run
all three candidates serially through the existing two-scenario ShiftX protocol.
Do not tune candidate code before the first three-way result.
