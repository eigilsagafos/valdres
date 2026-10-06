// Transaction.resetAll(): the independent review's probe scripts, copied into
// reset-all-review-probes/ (original review + v3 boundary, first-write and
// depth-cost audits). Each copy equals the reviewed original with the method
// name resetOwned replaced by resetAll and no other change. Each script asserts internally and sets
// a failing exit code; this file runs them against the source entry, keeps the
// per-state reset-loop controls discriminating, and pins the deterministic
// depth/work counters of the cold restore search (no timing thresholds).
import { describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import path from "node:path"

const probes = path.join(import.meta.dir, "reset-all-review-probes")
const packageDir = path.resolve(import.meta.dir, "../..")

const run = (script: string, ...args: string[]) => {
    const result = spawnSync(
        process.execPath,
        [path.join(probes, script), packageDir, "src", ...args],
        { encoding: "utf8", timeout: 120_000 },
    )
    // optional `NAME {...}` observation lines, then the pretty-printed report
    const output = result.stdout
    const start = output.startsWith("{\n") ? 0 : output.indexOf("\n{\n") + 1
    return {
        status: result.status,
        stderr: result.stderr,
        observations: output.slice(0, start).trim(),
        report: JSON.parse(output.slice(start)) as {
            results?: { name: string; pass: boolean; [key: string]: any }[]
            cases?: { name: string; pass: boolean; error?: string }[]
        },
    }
}

const passes = (script: string, ...args: string[]) => {
    const outcome = run(script, ...args)
    const results = outcome.report.results ?? outcome.report.cases ?? []
    expect(results.filter(result => !result.pass)).toEqual([])
    expect(results.length).toBeGreaterThan(0)
    expect(outcome.status).toBe(0)
    return outcome
}

describe("resetAll independent-review probes", () => {
    for (const script of [
        "atomic-public-probes.mjs",
        "collection-probes.mjs",
        "descendant-probes.mjs",
        "boundary-probes.mjs",
        "first-write-probes.mjs",
    ])
        test(script, () => {
            passes(script)
        })

    for (const script of [
        "adversarial-query-probes.mjs",
        "coherence-repros.mjs",
    ])
        test(`${script} (bulk) differs from its per-state reset-loop control`, () => {
            const bulk = passes(script, "bulk")
            const loop = run(script, "loop")
            expect(loop.status).toBe(0)
            // the loop control appends revealed rows, so its observed orders
            // differ: the probes discriminate order restoration
            expect(loop.observations).not.toBe(bulk.observations)
        })

    test("depth-cost-probes.mjs: exact route visits; warm reads do no work", () => {
        const { report } = passes("depth-cost-probes.mjs")
        const zero = {
            collectionRowIntentsStaged: 0,
            collectionRowRouteVisits: 0,
            collectionMembershipRecordCreations: 0,
            collectionMembershipRouteVisits: 0,
            collectionMembershipRowsScanned: 0,
            collectionMembershipArrayAllocations: 0,
            selectorEvaluations: 0,
            collectionIndexExtractorCalls: 0,
            collectionIndexBucketRows: 0,
        }
        const samples = report
            .results!.filter(result => result.name.startsWith("depth "))
            .flatMap(result => result.samples)
        expect(samples.length).toBe(21)
        for (const { followers: f, rowCount, counters } of samples) {
            // The cold draft restore search revisits the chain per follower:
            // f² + f + 2 route visits at the cleared leaf (Θ(depth²)), with a
            // further f + 1 rows-scanned pass for the deepest follower.
            const expected: Record<string, typeof zero> = {
                "cold-leaf-membership": {
                    ...zero,
                    collectionMembershipRouteVisits: f * f + f + 2,
                    collectionMembershipRowsScanned: 1,
                },
                "warm-leaf-membership-32": zero,
                "cold-leaf-query": {
                    ...zero,
                    collectionIndexExtractorCalls: rowCount,
                },
                "warm-leaf-query-32": zero,
            }
            if (f > 0) {
                expected["cold-deepest-follower-membership"] = {
                    ...zero,
                    collectionMembershipRouteVisits: f * f + 2 * f + 2,
                    collectionMembershipRowsScanned: f + 1,
                }
                expected["warm-deepest-follower-membership-32"] = zero
            }
            expect({ f, rowCount, counters }).toEqual({
                f,
                rowCount,
                counters: expected,
            })
        }
        const firstWrite = report.results!.find(
            result => result.name === "first-write optimization counters",
        )!
        expect(firstWrite.sample.counters).toEqual({
            "first-neutral-write-and-dependent-membership": {
                ...zero,
                collectionRowIntentsStaged: 1,
                collectionMembershipRouteVisits: 9,
                collectionMembershipRowsScanned: 387,
            },
            "later-neutral-writes-and-dependent-membership-16": {
                ...zero,
                collectionRowIntentsStaged: 16,
            },
            "later-neutral-write-and-query": {
                ...zero,
                collectionRowIntentsStaged: 1,
                collectionIndexExtractorCalls: 64,
            },
        })
    })
})
