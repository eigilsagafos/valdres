import { describe, expect, test } from "bun:test"
import {
    NORMALIZED_LATENCY_MEASURE,
    RUNNER_CONTROL_BENCHMARKS,
    toBmf,
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
            ],
            { excludeRefs: true, excludeTiny: true },
        )

        expect(bmf).toEqual({
            "get 1000 atoms / valdres": { latency: { value: 100 } },
        })
    })
})
