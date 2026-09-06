// Keep parser/statistics module graphs out of the shared runtime test process:
// frozen family leak checks snapshot that process's entire heap.
import { test, expect } from "bun:test"
import { spawnSync } from "node:child_process"
import { readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { stripVTControlCharacters } from "node:util"
const directory = dirname(fileURLToPath(import.meta.url))
const files = [
    "artifact.test.ts",
    "authority.test.ts",
    "evidence.test.ts",
    "graph-oracle.test.ts",
    "inputs.test.ts",
    "memory-sampler.test.ts",
    "observation.test.ts",
    "provenance-inventory.test.ts",
    "readiness.test.ts",
    "resources.test.ts",
    "semantic-cache.test.ts",
    "semantic-cases.test.ts",
    "shiftx-validation.test.ts",
    "size-process.test.ts",
    "source-memory.test.ts",
    "timing-schedule.test.ts",
    "verification.test.ts",
    "workloads.test.ts",
]
export function validateSelfTestResult(result, expected) {
    const text = stripVTControlCharacters(result.stdout + "\n" + result.stderr)
    const summaries = [
        ...text.matchAll(
            /^\s*(\d+) pass\s*\n(?:\s*\d+ (?:skip|todo)\s*\n)*\s*(\d+) fail/gm,
        ),
    ]
    const inventory = [
        ...text.matchAll(/Ran (\d+) tests? across (\d+) files?\./g),
    ]
    if (
        result.status !== 0 ||
        result.signal ||
        result.error ||
        summaries.length !== 1 ||
        +summaries[0][1] !== expected.tests ||
        +summaries[0][2] !== 0 ||
        /^\s*[1-9]\d* (?:skip|todo)/m.test(text) ||
        inventory.length !== 1 ||
        +inventory[0][1] !== expected.tests ||
        +inventory[0][2] !== expected.files
    )
        throw Error(
            "TOURNAMENT-SELF-TESTS: failed, crashed, skipped, or incomplete child inventory",
        )
    return {
        caseTests: +summaries[0][1],
        files: +inventory[0][2],
        assertions: [...text.matchAll(/(\d+) expect\(\) calls/g)].reduce(
            (sum, row) => sum + +row[1],
            0,
        ),
    }
}
let registered = false
export function isolatedTournamentFile() {
    if (process.env.VALDRES_TOURNAMENT_SELF_TEST_CHILD === "1") return true
    if (!registered) {
        registered = true
        test("isolated tournament self-test inventory (child cases reported separately)", () => {
            expect(
                readdirSync(directory)
                    .filter(path => path.endsWith(".test.ts"))
                    .sort(),
            ).toEqual(files)
            const result = spawnSync(
                process.execPath,
                ["test", ...files.map(path => join(directory, path))],
                {
                    cwd: join(directory, "../.."),
                    encoding: "utf8",
                    timeout: 110000,
                    maxBuffer: 16 * 1024 * 1024,
                    env: {
                        ...process.env,
                        FORCE_COLOR: "0",
                        VALDRES_TOURNAMENT_SELF_TEST_CHILD: "1",
                    },
                },
            )
            // Preserve the actual child output, including failures and counts.
            process.stdout.write(result.stdout ?? "")
            process.stderr.write(result.stderr ?? "")
            const totals = validateSelfTestResult(result, {
                tests: 107,
                files: files.length,
            })
            console.log(
                "TOURNAMENT-SELF-TESTS " +
                    JSON.stringify({ ...totals, dispatcherTests: 1 }),
            )
        }, 120000)
    }
    return false
}
