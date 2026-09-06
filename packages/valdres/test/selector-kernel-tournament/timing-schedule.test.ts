import { isolatedTournamentFile } from "./self-test-context.mjs"

if (isolatedTournamentFile()) {
    const { test, expect } = await import("bun:test")
    const { rotateLanes } = await import(
        "../../../../scripts/selector-kernel-tournament/timing-evidence.mjs"
    )
    const { manifest } = await import(
        "../../../../scripts/selector-kernel-tournament/inputs.mjs"
    )
    test("both stage schedules reproduce their complete lane inventory from the recorded seed", () => {
        for (const stage of ["C", "A"]) {
            const lanes = manifest.performanceWorkloads
                .filter(row => row.requiredAt.includes(stage))
                .flatMap(row =>
                    row.runtimes.map(runtime => row.id + "/" + runtime),
                )
            const scheduled = rotateLanes(lanes, 0x5eed)
            expect(scheduled).toEqual(rotateLanes(lanes, 0x5eed))
            expect([...scheduled].sort()).toEqual([...lanes].sort())
            expect(scheduled).not.toEqual(rotateLanes(lanes, 0x5eee))
        }
    })
}
