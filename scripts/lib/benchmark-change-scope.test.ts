import { describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { classifyBenchmarkChanges } from "./benchmark-change-scope.mjs"

function diff(...entries: Array<[string, ...string[]]>): Uint8Array {
    return new TextEncoder().encode(
        entries.flatMap(([status, ...paths]) => [status, ...paths]).join("\0") +
            "\0",
    )
}

function runs(input: Uint8Array | string, force = false): boolean {
    return classifyBenchmarkChanges(input, { force }).runBenchmarks
}

describe("benchmark change-scope classifier", () => {
    test.each([
        ["Changeset only", diff(["A", ".changeset/quiet-rivers.md"]), false],
        [
            "README, docs, and MDX only",
            diff(
                ["M", "README.md"],
                ["A", "docs/benchmarks.mdx"],
                ["D", "packages/valdres/GUIDE.md"],
            ),
            false,
        ],
        [
            "ordinary tests plus Changeset",
            diff(
                ["M", "packages/valdres/src/store.test.ts"],
                ["A", "packages/valdres/__tests__/types.ts"],
                ["A", ".changeset/calm-tools.md"],
            ),
            false,
        ],
        [
            "performance architecture documentation only",
            diff([
                "M",
                "packages/valdres/test/performance/ARCHITECTURE_PERFORMANCE.md",
            ]),
            false,
        ],
        [
            "production TypeScript",
            diff(["M", "packages/valdres/src/store.ts"]),
            true,
        ],
        [
            "performance harness",
            diff(["M", "packages/valdres/test/performance/store.bench.ts"]),
            true,
        ],
        [
            "benchmark workflow",
            diff(["M", ".github/workflows/bencher-pr.yml"]),
            true,
        ],
        ["benchmark converter", diff(["M", "scripts/bench-to-bmf.ts"]), true],
        [
            "package manifest",
            diff(["M", "packages/valdres/package.json"]),
            true,
        ],
        ["Bun lockfile", diff(["M", "bun.lock"]), true],
        [
            "mixed documentation and production",
            diff(["M", "README.md"], ["M", "packages/valdres/src/atom.ts"]),
            true,
        ],
        ["unknown path", diff(["A", "fixtures/mystery.data"]), true],
    ])("%s", (_name, input, expected) => {
        expect(runs(input as Uint8Array)).toBe(expected)
    })

    test("empty or malformed input fails closed", () => {
        expect(runs(new Uint8Array())).toBe(true)
        expect(runs("M\0README.md")).toBe(true)
        expect(runs(diff(["?", "README.md"]))).toBe(true)
        expect(runs(diff(["M", ""]))).toBe(true)
    })

    test("additions, modifications, and deletions use the path policy", () => {
        expect(
            runs(
                diff(
                    ["A", "docs/new.mdx"],
                    ["M", "README.md"],
                    ["D", "packages/valdres/src/old.spec.ts"],
                ),
            ),
        ).toBe(false)
        expect(runs(diff(["D", "packages/valdres/src/atom.ts"]))).toBe(true)
    })

    test("renames and copies fail closed", () => {
        expect(runs(diff(["R100", "README.md", "docs/README.md"]))).toBe(true)
        expect(runs(diff(["C087", "README.md", "docs/COPY.md"]))).toBe(true)
        expect(runs(diff(["R100", "README.md"]))).toBe(true)
    })

    test("benchmark Vitest configurations are relevant", () => {
        expect(
            runs(
                diff([
                    "M",
                    "packages/valdres/vitest.architecture-bench.config.ts",
                ]),
            ),
        ).toBe(true)
    })

    test("performance paths override README-like source names", () => {
        expect(
            runs(
                diff([
                    "M",
                    "packages/valdres/test/performance/readme-fixtures.ts",
                ]),
            ),
        ).toBe(true)
        expect(runs(diff(["M", "scripts/lib/readme-sources.ts"]))).toBe(false)
    })

    test("the run-benchmarks label forces measurement", () => {
        expect(runs(diff(["M", "README.md"]), true)).toBe(true)
        expect(runs(new Uint8Array(), true)).toBe(true)
    })

    test("the Node CLI reads NUL-safe diff input end to end", () => {
        const cli = join(import.meta.dir, "benchmark-change-scope.mjs")
        const skipped = spawnSync("node", [cli], {
            input: diff(["M", "README.md"]),
            encoding: "utf8",
        })
        expect(skipped.error).toBeUndefined()
        expect(skipped.status).toBe(0)
        expect(skipped.stdout.trim()).toBe("false")
        expect(skipped.stderr).toContain(
            "all changed paths are clearly non-runtime",
        )

        const relevant = spawnSync("node", [cli], {
            input: diff(["M", "packages/valdres/src/store.ts"]),
            encoding: "utf8",
        })
        expect(relevant.status).toBe(0)
        expect(relevant.stdout.trim()).toBe("true")
        expect(relevant.stderr).toContain("runtime-relevant or unknown path")
    })
})
