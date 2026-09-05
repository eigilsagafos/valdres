import { test, expect } from "bun:test"
import { manifest } from "../../../../scripts/selector-kernel-tournament/inputs.mjs"
import {
    sourceMemoryRows,
    assertSourceMemory,
} from "../../../../scripts/selector-kernel-tournament/source-memory.mjs"
function sample() {
    return {
        stdout: manifest.sourceMemoryScenarios
            .map(s =>
                JSON.stringify({
                    scenario: s.name,
                    runtime: "node",
                    units: s.units,
                    retainedBytes: s.units * 80,
                    retainedBytesPerUnit: 80,
                    releasedBytes: 1000,
                }),
            )
            .join("\n"),
        stderr: "",
    }
}
test("source absolute evidence preserves all eight original ceilings and unrounded arithmetic", () => {
    expect(
        sourceMemoryRows(sample(), "node", "candidate", "raw.json"),
    ).toHaveLength(8)
    for (const dimension of ["retainedBytes", "releasedBytes"]) {
        const process = sample(),
            rows = process.stdout.split("\n").map(line => JSON.parse(line))
        rows[0][dimension] =
            dimension === "retainedBytes" ? rows[0].units * 120 + 1 : 262145
        rows[0].retainedBytesPerUnit = Math.round(
            rows[0].retainedBytes / rows[0].units,
        )
        process.stdout = rows.map(row => JSON.stringify(row)).join("\n")
        expect(() =>
            assertSourceMemory(process, "node", "candidate", "raw.json"),
        ).toThrow("MEMORY-ABSOLUTE: source-absolute")
    }
})
test("missing, duplicate, unknown, or altered source measurements cannot satisfy the absolute gate", () => {
    for (const mutation of [
        "missing",
        "duplicate",
        "unknown",
        "units",
        "extra",
        "rounding",
    ]) {
        const process = sample(),
            rows = process.stdout.split("\n").map(line => JSON.parse(line))
        if (mutation === "missing") rows.pop()
        if (mutation === "duplicate") rows.push(rows[0])
        if (mutation === "unknown") rows[0].scenario = "M-GLOBAL-FANOUT"
        if (mutation === "units") rows[0].units++
        if (mutation === "extra") rows[0].extra = true
        if (mutation === "rounding") rows[0].retainedBytesPerUnit++
        process.stdout = rows.map(row => JSON.stringify(row)).join("\n")
        expect(() =>
            sourceMemoryRows(process, "node", "candidate", "raw.json"),
        ).toThrow("SOURCE-MEMORY-")
    }
})

test("Vitest ANSI decoration does not discard original source measurements", () => {
    const process = sample()
    process.stdout = process.stdout
        .split("\n")
        .map(line => "\x1b[22m\x1b[39m" + line)
        .join("\n")
    expect(
        sourceMemoryRows(process, "node", "control", "raw.json"),
    ).toHaveLength(8)
})
