import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const workflow = readFileSync(
    join(import.meta.dir, "../.github/workflows/bencher-pr.yml"),
    "utf8",
)

describe("Bencher PR workflow", () => {
    test("uses the schema's base/head side vocabulary", () => {
        expect(workflow).toContain("pair_order=(head base)")
        expect(workflow).toContain("pair_order=(base head)")
        expect(workflow).toContain('export BENCH_SIDE="$side"')
        expect(workflow).not.toContain("pair_order=(pr base)")
        expect(workflow).not.toContain("pair_order=(base pr)")
    })

    test("copies the schema and retains compact observations", () => {
        expect(workflow).toContain("benchmark-result-schema.ts")
        expect(workflow).toContain("actions/upload-artifact@v4")
        expect(workflow).toContain("/tmp/base_bun.ndjson")
        expect(workflow).toContain("/tmp/pr_node.ndjson")
    })
})
