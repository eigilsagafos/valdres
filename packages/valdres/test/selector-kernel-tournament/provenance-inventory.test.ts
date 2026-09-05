import { test, expect } from "bun:test"
import { competingProcesses } from "../../../../scripts/selector-kernel-tournament/provenance.mjs"
import {
    withRecordedRoot,
    recordedRoot,
} from "../../../../scripts/selector-kernel-tournament/recorded-root.mjs"
import { sourceMemoryCommand } from "../../../../scripts/selector-kernel-tournament/source-memory.mjs"
const parents =
    "1 0 launchd\n42 1 bun scripts/selector-kernel-tournament/control-bundle.mjs run\n43 42 bun observer.mjs\n"
test("actual evidence worker paths and tournament orchestrators invalidate competing runs", () => {
    for (const argv of [
        "bun scripts/selector-kernel-tournament/control-bundle.mjs run",
        "bun scripts/selector-kernel-tournament/red-bundle.mjs run green output",
        "node /shared/sha/beta36/1/run/timing-A/worker.mjs package-root manifest id timed",
        "node --expose-gc /shared/sha/beta36/1/run/memory/worker.mjs package-root",
        "node /shared/development/provenance-mismatch-baseline/workload-worker.mjs package-root",
        "node /shared/control/semantics-counter/semantic-worker.mjs package-root",
        "node /archive/node_modules/vitest/vitest.mjs run --config vitest.memory.config.ts ./test/performance/architecture.memory.ts",
        "bun --filter valdres bench:bun",
    ])
        expect(
            competingProcesses(parents + "70 1 " + argv + "\n", 43),
        ).toHaveLength(1)
    expect(competingProcesses(parents, 43)).toHaveLength(0)
    expect(() => competingProcesses(parents, 999)).toThrow(
        "PROVENANCE-ENVIRONMENT",
    )
})
test("recorded paths scope asynchronously without loading authority from historical workspaces", async () => {
    const original = recordedRoot()
    const result = await Promise.all(
        ["/old/lansing", "/other/root"].map(root =>
            withRecordedRoot(root, async () => {
                await Promise.resolve()
                expect(recordedRoot()).toBe(root)
                expect(sourceMemoryCommand("node", root)).toContain(
                    root + "/node_modules/vitest/vitest.mjs",
                )
                return root
            }),
        ),
    )
    expect(result).toEqual(["/old/lansing", "/other/root"])
    expect(recordedRoot()).toBe(original)
    expect(() => withRecordedRoot("relative", () => {})).toThrow(
        "PROVENANCE-RECORDED-ROOT",
    )
})
