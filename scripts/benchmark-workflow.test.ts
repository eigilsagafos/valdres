import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const workflow = readFileSync(
    join(import.meta.dir, "../.github/workflows/bencher-pr.yml"),
    "utf8",
)

describe("Bencher PR workflow", () => {
    test("uses the schema's base/head side vocabulary", () => {
        expect(workflow).toContain('export BENCH_SIDE="$side"')
        expect(workflow).not.toContain("pair_order=(pr base)")
        expect(workflow).not.toContain("pair_order=(base pr)")
    })

    test("measures in balanced B-P-P-B blocks", () => {
        const block = workflow.match(/run_block\(\) \{[\s\S]*?\n\s*\}/)
        expect(block).not.toBeNull()
        const sides = [
            ...block![0].matchAll(/"\$suite" (base|head) (\d)/g),
        ].map(match => `${match[1]}@${match[2]}`)
        // Wall-clock order base, head, head, base — and within each pair the
        // two sides take execution slots 1 and 2 in opposite order, which is
        // what cancels a linear drift across the block.
        expect(sides).toEqual(["base@1", "head@2", "head@1", "base@2"])
    })

    test("feeds the catastrophic gate exactly three pairs, as before", () => {
        // `min` is monotone decreasing in pair count, so an extra pair can only
        // weaken the gate: min([1.7,1.7,1.7]) blocks, min([1.7,1.7,1.7,1.0])
        // passes. Round 1 gates blocks 1a+1b and 2a only; 2b and every ladder
        // round are report-only.
        const round = workflow.match(/run_round\(\) \{[\s\S]*?\n\s*\}/)
        expect(round).not.toBeNull()
        expect(round![0]).toContain(
            'run_block "$round" 1 "$runtime" "$suite" "$gate" "$gate"',
        )
        expect(round![0]).toContain(
            'run_block "$round" 2 "$runtime" "$suite" "$gate" 0',
        )
        expect(round![0]).toContain('if [[ "$round" == "1" ]]; then gate=1; fi')
    })

    test("keeps ladder rounds out of the catastrophic gate's inputs", () => {
        // The gate reads /tmp/{base,pr}_*.ndjson, written only when a pair's
        // gate flag is set; every round accumulates into /tmp/all_*.ndjson.
        expect(workflow).toContain('if [[ "$gate" == "1" ]]; then')
        expect(workflow).toContain(
            'cat "$result" >> "/tmp/all_${output}.ndjson"',
        )
        expect(workflow).toContain("BENCH_NDJSON_BUN=/tmp/base_bun.ndjson")
        expect(workflow).toContain("--threshold-upper-boundary 0.5")
    })

    test("the job summary is appended exactly once, by the workflow", () => {
        expect(workflow.match(/GITHUB_STEP_SUMMARY/g)).toHaveLength(1)
        expect(workflow).toContain(
            'cat /tmp/paired-report.md >> "$GITHUB_STEP_SUMMARY"',
        )
    })

    test("bounds the rerun ladder", () => {
        expect(workflow).toContain('BENCH_MAX_ROUNDS: "3"')
        expect(workflow).toContain(
            'while [[ "$completed" -lt "$BENCH_MAX_ROUNDS" ]]',
        )
        expect(workflow).toContain("BENCH_RERUN_LANES_FILE=/tmp/rerun-lanes")
    })

    test("the ladder does not use seq to build its round range", () => {
        // BSD `seq 2 1` counts DOWN rather than yielding an empty range, so a
        // BENCH_MAX_ROUNDS of 1 would silently execute rounds 2 and 1 for
        // anyone driving this outside GNU coreutils.
        expect(workflow).not.toContain("$(seq")
    })

    test("a failed analysis cannot fail the job or skip the real gate", () => {
        // This step runs under `set -euo pipefail` BEFORE the gate steps, so an
        // unguarded throw in report-only tooling would take the catastrophic
        // gate down with it.
        const analyze = workflow.match(/analyze\(\) \{[\s\S]*?\n\s*\}\n/)
        expect(analyze).not.toBeNull()
        expect(analyze![0]).toContain("if ! BENCH_ROUND=")
        expect(analyze![0]).toContain(
            "::warning::Paired decision report failed",
        )
        // Truncated first, so a crashed analysis requests no reruns rather than
        // replaying the previous round's lanes.
        expect(analyze![0]).toContain(": > /tmp/rerun-lanes")
    })

    test("the paired report cannot fail the job", () => {
        const step = workflow.match(
            /- name: Publish paired decision report[\s\S]*?\n\n/,
        )
        expect(step).not.toBeNull()
        expect(step![0]).toContain("continue-on-error: true")
        // Tolerates the report never having been written.
        expect(step![0]).toContain("if [[ ! -f /tmp/paired-report.md ]]")
    })

    test("copies the schema and retains compact observations", () => {
        expect(workflow).toContain("benchmark-result-schema.ts")
        expect(workflow).toContain("actions/upload-artifact@v4")
        expect(workflow).toContain("/tmp/base_bun.ndjson")
        expect(workflow).toContain("/tmp/pr_node.ndjson")
        expect(workflow).toContain("/tmp/paired-report.json")
    })
})
