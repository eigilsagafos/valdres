import { test, expect } from "bun:test"
import { manifest } from "../../../../scripts/selector-kernel-tournament/inputs.mjs"
import {
    decideMemory,
    memoryProcessSummary,
} from "../../../../scripts/selector-kernel-tournament/resource-validation.mjs"
function observations() {
    return manifest.memoryScenarios.flatMap(s =>
        s.runtimes.flatMap(runtime =>
            Array.from({ length: 5 }, (_, pair) =>
                manifest.stages.A.timingOrder[pair % 2].map(arm => ({
                    id: s.id,
                    runtime,
                    pairId: String(pair),
                    arm,
                    process: `${s.id}-${runtime}-${pair}-${arm}.json`,
                    processSha256: "a".repeat(64),
                    sample: {
                        schemaVersion: 2,
                        kind: "memory-process",
                        id: s.id,
                        runtime,
                        pid: 1,
                        unitCount: s.units,
                        samples: Array.from({ length: 3 }, () => ({
                            before: 1000000,
                            retainedHeap: 1000000 + s.units * 40,
                            releasedHeaps: [1000000, 1000000, 1000000],
                        })),
                    },
                })),
            ).flat(),
        ),
    )
}
test("five memory pairs cover every frozen scenario/runtime and apply relative and absolute gates separately", () => {
    const records = observations()
    expect(decideMemory(records)).toHaveLength(12)
    expect(decideMemory(records).every(r => r.status === "pass")).toBe(true)
    for (const r of records.filter(
        r =>
            r.id === manifest.memoryScenarios[0].id &&
            r.runtime === "bun" &&
            r.arm === "candidate",
    ))
        for (const s of r.sample.samples)
            s.retainedHeap = s.before + r.sample.unitCount * 48
    const rows = decideMemory(records)
    expect(rows.filter(r => r.status === "fail")).toHaveLength(1)
    expect(rows[0].retainedRatio).toBe(1.2)
    expect(() => decideMemory(records.slice(1))).toThrow("MEMORY-PAIRS")
    const wrong = observations()
    wrong[0].sample.unitCount++
    expect(() => decideMemory(wrong)).toThrow("MEMORY-ID")
    const duplicate = observations()
    duplicate[1].arm = "control"
    expect(() => decideMemory(duplicate)).toThrow("MEMORY-ORDER")
})
test("released residual and every one of the original three samples remain observable", () => {
    const sample = observations()[0].sample
    for (const s of sample.samples)
        s.releasedHeaps = [2000000, 1900000, 1800000]
    expect(memoryProcessSummary(sample).absolutePass).toBe(false)
    sample.samples.pop()
    expect(() => memoryProcessSummary(sample)).toThrow("MEMORY-SAMPLES")
})

test("post-release leak detection compares retained residual, not heap changes below the pre-run baseline", () => {
    const sample = observations()[0].sample
    sample.samples[2].releasedHeaps = [999994, 999996, 999998]
    expect(() => memoryProcessSummary(sample)).not.toThrow()
    sample.samples[2].releasedHeaps = [1000000, 1000002, 1000004]
    expect(() => memoryProcessSummary(sample)).toThrow("MEMORY-MONOTONIC-LEAK")
})
