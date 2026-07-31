import { describe, expect, test } from "bun:test"
import {
    NORMALIZED_LATENCY_MEASURE,
    RUNNER_CONTROL_BENCHMARKS,
    toBmf,
    toPairedBmf,
} from "./bench-to-bmf"
import type { BenchResult } from "./lib/read-bench-results"

const latency = (name: string, ns: number): BenchResult => ({
    kind: "latency",
    name,
    ns,
})

const controls = (ns: number): BenchResult[] =>
    RUNNER_CONTROL_BENCHMARKS.map(name => latency(name, ns))

describe("bench-to-bmf", () => {
    test("normalizes gateable Valdres benchmarks with the fixed control index", () => {
        const bmf = toBmf(
            [
                ...controls(10),
                latency("get 1000 atoms / valdres", 100),
                latency("get 1000 atoms / valdres", 300),
                latency("get 1000 atoms / valdres", 200),
                latency("scope: set atom, 5 scopes (realistic)", 60),
                latency("store.get(atom) / valdres", 20),
                latency("new comparison / jotai", 1_000_000),
            ],
            { normalize: true },
        )

        expect(bmf["get 1000 atoms / valdres"].latency.value).toBe(200)
        expect(
            bmf["get 1000 atoms / valdres"][NORMALIZED_LATENCY_MEASURE].value,
        ).toBeCloseTo(20)
        expect(
            bmf["scope: set atom, 5 scopes (realistic)"][
                NORMALIZED_LATENCY_MEASURE
            ].value,
        ).toBeCloseTo(6)
        expect(bmf["store.get(atom) / valdres"]).toEqual({
            latency: { value: 20 },
        })
        expect(bmf["new comparison / jotai"]).toEqual({
            latency: { value: 1_000_000 },
        })
    })

    test("cancels a runner-wide multiplicative slowdown", () => {
        const normal = toBmf(
            [...controls(10), latency("set 1000 atoms / valdres", 250)],
            { normalize: true },
        )
        const slowRunner = toBmf(
            [...controls(20), latency("set 1000 atoms / valdres", 500)],
            { normalize: true },
        )

        expect(
            normal["set 1000 atoms / valdres"][NORMALIZED_LATENCY_MEASURE]
                .value,
        ).toBeCloseTo(
            slowRunner["set 1000 atoms / valdres"][NORMALIZED_LATENCY_MEASURE]
                .value,
        )
    })

    test("uses a geometric mean for differently scaled controls", () => {
        const mixedControls = RUNNER_CONTROL_BENCHMARKS.map((name, index) =>
            latency(name, index % 2 === 0 ? 1 : 100),
        )
        const bmf = toBmf(
            [...mixedControls, latency("set 1000 atoms / valdres", 200)],
            { normalize: true },
        )

        // Four controls at 1 and four at 100 have a geometric mean of 10.
        expect(
            bmf["set 1000 atoms / valdres"][NORMALIZED_LATENCY_MEASURE].value,
        ).toBeCloseTo(20)
    })

    test("fails closed when a fixed runner control is missing", () => {
        expect(() =>
            toBmf(
                [
                    ...controls(10).slice(1),
                    latency("set 1000 atoms / valdres", 250),
                ],
                { normalize: true },
            ),
        ).toThrow(`Missing runner controls: ${RUNNER_CONTROL_BENCHMARKS[0]}`)
    })

    test("preserves PR filtering without requiring normalization", () => {
        const bmf = toBmf(
            [
                latency("get 1000 atoms / valdres", 100),
                latency("get 1000 atoms / jotai", 200),
                latency("store.get(atom) / valdres", 20),
                latency("atomFamily(id) / valdres", 150),
                latency("selectorFamily(id) / valdres", 300),
            ],
            { excludeRefs: true, excludeTiny: true },
        )

        expect(bmf).toEqual({
            "get 1000 atoms / valdres": { latency: { value: 100 } },
        })
    })

    test("converts a paired ratio rather than a ratio of medians", () => {
        const name = "async settle: selector resolve observed"
        const paired = toPairedBmf(
            [latency(name, 5_300), latency(name, 5_500), latency(name, 7_200)],
            [latency(name, 10_300), latency(name, 6_800), latency(name, 8_400)],
        )

        // Ratios are 1.943, 1.236, 1.167; the smallest is 8_400 / 7_200. Against
        // the separately uploaded 5_500ns base median that reports +16.7%.
        // Independent medians would incorrectly report +52.7%.
        expect(paired[name].latency.value).toBeCloseTo(5_500 * (8_400 / 7_200))
    })

    test("a stall in most pairs cannot manufacture a regression", () => {
        const name = "set(atom, value) / valdres"
        // Real shape observed in one CI job: the head side was measured at
        // 131ns, 351ns, 131ns while the base side stayed flat. Two of three
        // pairs are contaminated, so a median would report ~+168% and alert.
        const paired = toPairedBmf(
            [latency(name, 131), latency(name, 131), latency(name, 131)],
            [latency(name, 351), latency(name, 351), latency(name, 131)],
        )

        // The clean pair wins: no change reported, no alert.
        expect(paired[name].latency.value).toBeCloseTo(131)
    })

    test("a genuine regression present in every pair still gates", () => {
        const name = "set(atom, value) / valdres"
        // A real same-runner regression shifts every pair, so even the least
        // contaminated one is over the +50% boundary this gate enforces.
        const paired = toPairedBmf(
            [latency(name, 100), latency(name, 100), latency(name, 100)],
            [latency(name, 210), latency(name, 175), latency(name, 190)],
        )

        expect(paired[name].latency.value).toBeCloseTo(175)
        expect(paired[name].latency.value).toBeGreaterThan(100 * 1.5)
    })

    test("fails closed when paired samples are missing", () => {
        const name = "async settle: selector resolve observed"

        expect(() =>
            toPairedBmf(
                [latency(name, 5_300), latency(name, 5_500)],
                [latency(name, 6_800)],
            ),
        ).toThrow(`Mismatched paired sample count for ${name}: base=2, head=1`)
        expect(() =>
            toPairedBmf(
                [latency(name, 5_300)],
                [latency("async settle: atom resolve observed", 6_800)],
            ),
        ).toThrow(`missing from head: ${name}`)
    })
})
