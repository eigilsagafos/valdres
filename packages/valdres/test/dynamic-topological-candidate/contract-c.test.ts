import { test } from "bun:test"
import assert from "node:assert/strict"
import * as api from "../../src/index"
import * as adapter from "../../src/adapter-internals/v1"
import manifest from "../selector-kernel-tournament/fixture-manifest.v3.json"
import { runSemanticCases } from "../selector-kernel-tournament/semantic-cases.mjs"

test("selected root repeats the complete unmodified Contract C corpus", async () => {
    const only = manifest.semanticCases
        .filter(row => row.requiredAt.includes("C"))
        .map(row => row.id)
    let previous: unknown
    for (let repeat = 0; repeat < 2; repeat++) {
        const rows = await runSemanticCases({
            api,
            adapter,
            manifest,
            only,
            stage: "C",
        })
        const traces = rows.map((row: { id: string; traceSha256: string }) => [
            row.id,
            row.traceSha256,
        ])
        assert.equal(rows.length, 10)
        if (previous) assert.deepEqual(traces, previous)
        previous = traces
    }
}, 600000)
