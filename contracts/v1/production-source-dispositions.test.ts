import { describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const directory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(directory, "../..")
const ledgerPath = join(directory, "production-source-dispositions.jsonl")
const generatorPath = join(
    directory,
    "generate-production-source-dispositions.ts",
)

const records = readFileSync(ledgerPath, "utf8")
    .split(/\r?\n/u)
    .filter(line => line.trim().length > 0)
    .map(line => JSON.parse(line) as any)
const sourceRows = records.filter(
    record => record.recordType === "source-disposition",
)

describe("v1 production-source disposition ledger", () => {
    test("validates the deterministic seed and exact frozen-source joins", () => {
        const result = spawnSync(
            process.execPath,
            [generatorPath, "--check-seed"],
            {
                cwd: repositoryRoot,
                encoding: "utf8",
            },
        )
        expect(result.status, result.stderr).toBe(0)
        expect(result.stdout).toContain(
            "production source ledger verified: 190 proposed rows",
        )
    })

    test("keeps all source rows proposed and outside the A/B/C/D/E taxonomy", () => {
        expect(sourceRows).toHaveLength(190)
        expect(sourceRows.every(row => row.reviewStatus === "proposed")).toBe(
            true,
        )
        expect(
            sourceRows.every(
                row =>
                    row.disposition === undefined &&
                    row.subject.kind === "production-file",
            ),
        ).toBe(true)
        expect(
            new Set(
                sourceRows.flatMap(row =>
                    row.actions.map((item: any) => item.mode),
                ),
            ),
        ).toEqual(new Set(["retain", "replace", "move", "retire"]))
    })

    test("makes every mixed or uncertain seed row visibly review-blocked", () => {
        const reviewBlocked = sourceRows.filter(
            row => row.review.classification !== "straightforward",
        )
        expect(reviewBlocked.length).toBeGreaterThan(0)
        expect(
            reviewBlocked.every(
                row =>
                    row.reviewStatus === "proposed" &&
                    row.review.reasons.length > 0,
            ),
        ).toBe(true)
        expect(
            sourceRows
                .filter(row => row.actions.length > 1)
                .every(
                    row => row.review.classification === "mixed-needs-review",
                ),
        ).toBe(true)
    })
})
