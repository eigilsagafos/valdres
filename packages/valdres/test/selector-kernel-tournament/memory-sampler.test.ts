import { test, expect } from "bun:test"
import {
    mkdtempSync,
    mkdirSync,
    writeFileSync,
    readFileSync,
    rmSync,
} from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { ROOT } from "../../../../scripts/selector-kernel-tournament/inputs.mjs"
import { buildLegacyWrappers } from "../../../../scripts/selector-kernel-tournament/legacy-wrappers.mjs"
import { captureCommand } from "../../../../scripts/selector-kernel-tournament/artifact.mjs"
import { memoryProcessSummary } from "../../../../scripts/selector-kernel-tournament/resource-validation.mjs"
// This empty test subject contains no kernel. It catches the standalone Node
// sampler reporting its own initialization as a retained State leak.
test("a fresh Node sampler with no State operations does not manufacture a retained-memory leak", () => {
    const temporary = mkdtempSync(join(tmpdir(), "tournament-empty-sampler-"))
    try {
        const wrapper = join(temporary, "factories.mjs"),
            worker = join(temporary, "worker.mjs"),
            subject = join(temporary, "empty-subject")
        mkdirSync(join(subject, "dist"), { recursive: true })
        writeFileSync(join(subject, "package.json"), '{"type":"module"}')
        writeFileSync(join(subject, "dist/index.js"), "export {}\n")
        buildLegacyWrappers(wrapper)
        const source = readFileSync(wrapper, "utf8").replace(
            "export function makeMemoryFactory",
            "function unusedMemoryFactory",
        )
        writeFileSync(
            wrapper,
            source +
                "\nexport function makeMemoryFactory(){return ()=>({units:4000,release(){}})}\n",
        )
        const built = captureCommand(
            [
                "bun",
                "build",
                join(
                    ROOT,
                    "scripts/selector-kernel-tournament/memory-worker.mjs",
                ),
                "--target=node",
                `--outfile=${worker}`,
            ],
            ROOT,
        )
        expect(built.status).toBe(0)
        const process = captureCommand(
            [
                "node",
                "--expose-gc",
                worker,
                subject,
                join(
                    ROOT,
                    "packages/valdres/test/selector-kernel-tournament/fixture-manifest.v2.json",
                ),
                "M-ATOM-ONLY-STORES",
                wrapper,
            ],
            ROOT,
        )
        expect(process.status).toBe(0)
        const sample = JSON.parse(process.stdout)
        expect(sample.samplerCalibration.publicOperations).toBe(0)
        expect(sample.samplerCalibration.samples).toHaveLength(3)
        expect(sample.samples).toHaveLength(3)
        expect(memoryProcessSummary(sample).absolutePass).toBe(true)
    } finally {
        rmSync(temporary, { recursive: true, force: true })
    }
})
