import { isolatedTournamentFile } from "./self-test-context.mjs"

if (isolatedTournamentFile()) {
    const { test, expect } = await import("bun:test")
    const { manifest } = await import(
        "../../../../scripts/selector-kernel-tournament/inputs.mjs"
    )
    const { profileTimeline, interactionDuration, decideShiftx } = await import(
        "../../../../scripts/selector-kernel-tournament/shiftx.mjs"
    )
    const lanes = (ratio = 1, pairs = 8) =>
        manifest.shiftxWorkloads.map(row => ({
            id: row.id,
            samples: Array.from({ length: pairs }, (_, i) => ({
                pairId: String(i),
                baseNs: 1000000 + i * 100,
                headNs: (1000000 + i * 100) * ratio,
            })),
        }))
    test("Chrome profile timestamps retain signed timeDeltas from Profile.startTime across chunks", () => {
        const trace = {
            traceEvents: [
                {
                    name: "Profile",
                    id: "p",
                    pid: 1,
                    tid: 2,
                    args: { data: { startTime: 1000 } },
                },
                {
                    name: "ProfileChunk",
                    id: "p",
                    pid: 1,
                    tid: 2,
                    args: {
                        data: {
                            cpuProfile: { nodes: [{ id: 1 }], samples: [1, 1] },
                            timeDeltas: [10, -4],
                        },
                    },
                },
                {
                    name: "ProfileChunk",
                    id: "p",
                    pid: 1,
                    tid: 2,
                    args: {
                        data: { cpuProfile: { samples: [1] }, timeDeltas: [9] },
                    },
                },
            ],
        }
        expect(profileTimeline(trace)[0].samples).toEqual([
            { node: 1, delta: 10, at: 1010 },
            { node: 1, delta: -4, at: 1006 },
            { node: 1, delta: 9, at: 1015 },
        ])
        trace.traceEvents[1].args.data.timeDeltas.pop()
        expect(() => profileTimeline(trace)).toThrow("SHIFTX-PROFILE")
    })
    test("interaction timing ends at the containing RunTask and preserves the fixed gesture count", () => {
        const trace = {
            traceEvents: [
                { name: "up", ts: 100, pid: 1, tid: 2 },
                { name: "RunTask", ts: 90, dur: 40, pid: 1, tid: 2 },
            ],
        }
        expect(
            interactionDuration(trace, {
                startMarker: "up",
                stepMarker: "up",
                expectedSteps: 1,
            }),
        ).toBe(30000)
        expect(() =>
            interactionDuration(trace, {
                startMarker: "up",
                stepMarker: "up",
                expectedSteps: 15,
            }),
        ).toThrow("SHIFTX-INTERACTION")
    })
    test("ShiftX keeps the existing paired estimator, protected direction, and bounded extension rule", () => {
        expect(decideShiftx(lanes(), "beta36-control").status).toBe("pass")
        expect(decideShiftx(lanes(1.2), "beta36-control").status).toBe("fail")
        expect(() => decideShiftx(lanes(1, 12), "beta36-control")).toThrow(
            "SHIFTX-SELECTIVE-EXTENSION",
        )
        expect(() => decideShiftx(lanes(1, 9), "beta36-control")).toThrow(
            "SHIFTX-PAIRS",
        )
        expect(decideShiftx(lanes(1.1, 12), "beta36-control").status).toBe(
            "inconclusive",
        )
        expect(
            decideShiftx(lanes(0.95), "pre28-claim").rows.every(
                r =>
                    r.decisions.pre28Claim?.status === "pass" &&
                    r.decisions.protectedNonRegression === null &&
                    r.decisions.intendedWin === null,
            ),
        ).toBe(true)
        expect(decideShiftx(lanes(1), "pre28-claim").status).toBe(
            "inconclusive",
        )
    })

    test("fifteen-step timing uses the chronologically final step and excludes pre-start markers", () => {
        const scenario = {
            startMarker: "start",
            stepMarker: "step",
            expectedSteps: 15,
        }
        const steps = Array.from({ length: 15 }, (_, i) => ({
            name: "step",
            ts: 110 + i * 5,
            pid: 1,
            tid: 2,
        }))
        const trace = {
            traceEvents: [
                { name: "start", ts: 100, pid: 1, tid: 2 },
                { name: "RunTask", ts: 100, dur: 130, pid: 1, tid: 2 },
                ...steps.toReversed(),
            ],
        }
        expect(interactionDuration(trace, scenario)).toBe(130000)
        trace.traceEvents[2].ts = 99
        expect(() => interactionDuration(trace, scenario)).toThrow(
            "SHIFTX-INTERACTION",
        )
    })
    test("a split process state cannot establish the diagnostic pre28 claim", () => {
        const rows = lanes(0.5)
        for (const row of rows)
            row.samples.forEach(
                (s, i) => (s.headNs = s.baseNs * (i % 2 ? 0.7 : 0.5)),
            )
        const result = decideShiftx(rows, "pre28-claim")
        expect(result.status).toBe("inconclusive")
        expect(
            result.rows.every(
                r =>
                    r.flags.includes("bimodal") &&
                    r.decisions.pre28Claim.status === "inconclusive",
            ),
        ).toBe(true)
    })
}
