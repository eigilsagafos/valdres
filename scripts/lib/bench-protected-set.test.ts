import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "fs"
import { join } from "path"
import { toBmf, UNGATEABLE_OPS } from "../bench-to-bmf"
import {
    AGGREGATED_EQUIVALENTS,
    isProtected,
    isSubMicrosecond,
    PROTECTED_OPS,
    TIMING_FLOOR_NS,
} from "./bench-protected-set"

const PERF_DIR = join(
    import.meta.dir,
    "../../packages/valdres/test/performance",
)
const SUITE_SOURCE = readdirSync(PERF_DIR)
    .filter(file => file.endsWith(".bench.ts") || file.endsWith(".timing.ts"))
    .map(file => readFileSync(join(PERF_DIR, file), "utf8"))
    .join("\n")

describe("protected set", () => {
    test("stays small enough for the FDR adjustment to have power", () => {
        // 11 benchmarks x 2 runtimes = 22 comparisons; see the characterisation
        // matrix in paired-decision.test.ts for what that buys at each rung.
        expect(PROTECTED_OPS.size).toBeLessThanOrEqual(12)
    })

    test("every protected benchmark still exists in the suite", () => {
        const missing = [...PROTECTED_OPS].filter(
            op => !SUITE_SOURCE.includes(op),
        )
        expect(missing).toEqual([])
    })

    test("membership requires clearing the timing floor", () => {
        expect(isProtected("get 1000 atoms / valdres", 9_400)).toBe(true)
        expect(isProtected("get 1000 atoms / valdres", 900)).toBe(false)
        expect(isProtected("get 1000 atoms / jotai", 9_400)).toBe(false)
        expect(isProtected("set(atom, value) / valdres", 50_000)).toBe(false)
    })

    test("the floor is what demotes nanosecond operations", () => {
        expect(isSubMicrosecond(131)).toBe(true)
        expect(isSubMicrosecond(TIMING_FLOOR_NS)).toBe(false)
    })

    test("protects direct family churn and quarantines the noisy txn row", () => {
        const direct = "atomFamily: direct create + delete 500 members"
        const noisy = "atomFamily: txn update 5,000 existing members"
        expect(SUITE_SOURCE).toContain(direct)
        expect(SUITE_SOURCE).toContain(noisy)
        expect(PROTECTED_OPS.has(direct)).toBe(true)
        expect(PROTECTED_OPS.has(noisy)).toBe(false)
        expect(UNGATEABLE_OPS.has(direct)).toBe(false)
    })

    test("keeps the new structural, high-cardinality, and root-store cases", () => {
        for (const workload of [
            "set equal structural value (1,024 rows)",
            "selectorFamily: lookup 10,000 retained entries",
            "create + dispose 1,000 root stores",
        ]) {
            expect(SUITE_SOURCE).toContain(workload)
        }
    })
})

describe("aggregated equivalents", () => {
    test("every op excluded from the shipped gate has a documented equivalent", () => {
        const undocumented = [...UNGATEABLE_OPS].filter(
            op => !(op in AGGREGATED_EQUIVALENTS),
        )
        expect(undocumented).toEqual([])
    })

    test("every named equivalent is itself a protected benchmark", () => {
        const dangling = Object.entries(AGGREGATED_EQUIVALENTS)
            .filter(([, aggregate]) => aggregate !== null)
            .filter(([, aggregate]) => !PROTECTED_OPS.has(aggregate!))
        expect(dangling).toEqual([])
    })

    test("every mapped operation still exists in the suite", () => {
        const missing = Object.keys(AGGREGATED_EQUIVALENTS).filter(
            op => !SUITE_SOURCE.includes(op),
        )
        expect(missing).toEqual([])
    })

    test("no mapped raw operation can reach the blocking BMF", () => {
        // Every operation the map calls tiny, measured at its real latency,
        // must be filtered out of the gate's conversion — the map claiming
        // coverage is only honest if the raw row is genuinely nonblocking.
        const measured: Record<string, number> = {
            "atom(1)": 2,
            "store.get(atom)": 30,
            "set(atom, value)": 110,
            "set(atom, curr => curr+1)": 99,
            "set(atom) with 10 subs": 141,
            "sub + unsub": 249,
            "selector(fn)": 6,
            "selectorFamily(id)": 205,
            "selectorFamily(number) cache hit": 40,
            "selectorFamily(string) cache hit": 31,
            "atomFamily(id)": 195,
            "atomFamily(id) cache hit": 13,
            "atomFamily(string) cache hit": 22,
            createStore: 286,
        }
        expect(Object.keys(measured).sort()).toEqual(
            Object.keys(AGGREGATED_EQUIVALENTS).sort(),
        )

        const bmf = toBmf(
            Object.entries(measured).map(([op, ns]) => ({
                kind: "latency" as const,
                name: `${op} / valdres`,
                ns,
            })),
            { excludeRefs: true, excludeTiny: true },
        )
        expect(Object.keys(bmf)).toEqual([])
    })

    test("the nanosecond hot paths named in the flake reports are covered", () => {
        // `set(atom, value)` and `sub + unsub` are the rows that repeatedly
        // flaked the shipped gate; both are demoted here and both keep coverage.
        expect(AGGREGATED_EQUIVALENTS["set(atom, value)"]).toBe(
            "set 1000 atoms",
        )
        expect(AGGREGATED_EQUIVALENTS["sub + unsub"]).toBe(
            "subscribe + unsubscribe 100 shared selector pairs",
        )
        expect(AGGREGATED_EQUIVALENTS["store.get(atom)"]).toBe("get 1000 atoms")
    })
})
