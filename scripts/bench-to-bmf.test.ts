import { describe, expect, test } from "bun:test"
import {
    NORMALIZED_LATENCY_MEASURE,
    RUNNER_CONTROL_BENCHMARKS,
    toBmf,
    toPairedBmf,
} from "./bench-to-bmf"
import {
    BENCHMARK_RESULT_SCHEMA_VERSION,
    type BenchmarkObservation,
    type BenchResult,
} from "./lib/read-bench-results"
import { parseBenchmarkObservation } from "../packages/valdres/test/performance/benchmark-result-schema"

const latency = (name: string, ns: number): BenchResult => ({
    kind: "latency",
    name,
    ns,
})

const controls = (ns: number): BenchResult[] =>
    RUNNER_CONTROL_BENCHMARKS.map(name => latency(name, ns))

const observation = (
    benchmark: string,
    p50: number,
    overrides: Partial<BenchmarkObservation> &
        Pick<BenchmarkObservation, "pairId" | "side">,
): BenchmarkObservation => {
    const { pairId, side, ...rest } = overrides
    const order = overrides.order ?? (side === "base" ? 1 : 2)
    return {
        schemaVersion: BENCHMARK_RESULT_SCHEMA_VERSION,
        kind: "latency",
        unit: "ns",
        benchmark,
        pairId,
        side,
        order,
        runtime: "bun",
        suite: "standard",
        runId: `${pairId}-${side}`,
        processId: side === "base" ? 100 : 200,
        p25: p50 * 0.8,
        p50,
        p75: p50 * 1.2,
        p99: p50 * 1.5,
        ticks: 1_000,
        sampleCount: 100,
        ...rest,
    }
}

const pair = (
    benchmark: string,
    pairId: string,
    base: number,
    head: number,
): [BenchmarkObservation, BenchmarkObservation] => [
    observation(benchmark, base, { pairId, side: "base" }),
    observation(benchmark, head, { pairId, side: "head" }),
]

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
        // Latencies are realistic: `get 1000 atoms` is ~9.4µs, the rest are the
        // nanosecond-scale raw operations the gate must not block on.
        const bmf = toBmf(
            [
                latency("get 1000 atoms / valdres", 9_400),
                latency("get 1000 atoms / jotai", 573_700),
                latency("store.get(atom) / valdres", 20),
                latency("atomFamily(id) / valdres", 150),
                latency("selectorFamily(id) / valdres", 300),
            ],
            { excludeRefs: true, excludeTiny: true },
        )

        expect(bmf).toEqual({
            "get 1000 atoms / valdres": { latency: { value: 9_400 } },
        })
    })

    test("excludeTiny blocks nothing below the timing floor", () => {
        // The hand-curated UNGATEABLE_OPS list omitted these; every one is a
        // sub-microsecond raw operation, and `set(atom, value)` / `sub + unsub`
        // are the rows that historically flaked the gate on unrelated PRs.
        const tiny = [
            latency("set(atom, value) / valdres", 110),
            latency("set(atom, curr => curr+1) / valdres", 99),
            latency("set(atom) with 10 subs / valdres", 141),
            latency("sub + unsub / valdres", 249),
            latency("createStore / valdres", 286),
        ]
        const bmf = toBmf(
            [...tiny, latency("set 1000 atoms / valdres", 73_400)],
            {
                excludeRefs: true,
                excludeTiny: true,
            },
        )

        expect(Object.keys(bmf)).toEqual(["set 1000 atoms / valdres"])
    })

    test("a sub-microsecond op stays out of the paired gate even when head crosses the floor", () => {
        // Base 900ns, head 1.8µs. Deciding the floor per side would keep the
        // head row, drop the base row, and fail the conversion closed.
        const bmf = toPairedBmf(
            [
                observation("set(atom, value) / valdres", 900, {
                    pairId: "p1",
                    side: "base",
                }),
            ],
            [
                observation("set(atom, value) / valdres", 1_800, {
                    pairId: "p1",
                    side: "head",
                }),
            ],
            { excludeRefs: true, excludeTiny: true },
        )

        expect(bmf).toEqual({})
    })

    test("validates schema version and rejects raw Mitata samples", () => {
        const result = observation("set 1000 atoms / valdres", 250, {
            pairId: "pair-1",
            side: "base",
        })

        expect(parseBenchmarkObservation(result, "test row")).toEqual(result)
        expect(() =>
            parseBenchmarkObservation(
                { ...result, samples: [200, 250, 300] },
                "test row",
            ),
        ).toThrow("raw Mitata samples must not be serialized")
        expect(() =>
            parseBenchmarkObservation(
                { ...result, schemaVersion: 999 },
                "test row",
            ),
        ).toThrow("unsupported benchmark schema version 999")
        expect(() =>
            parseBenchmarkObservation({ ...result, side: "pr" }, "test row"),
        ).toThrow("side must be base or head")
    })

    test("validates tier-settle diagnostics when present", () => {
        const result = observation("async settle: atom resolve observed", 250, {
            pairId: "pair-1",
            side: "base",
        })
        const settled = {
            ...result,
            tierWindows: 3,
            tierSettled: true,
            tierDiscardedP50s: [510, 260],
        }

        expect(parseBenchmarkObservation(result, "test row")).toEqual(result)
        expect(parseBenchmarkObservation(settled, "test row")).toEqual(settled)
        expect(() =>
            parseBenchmarkObservation(
                { ...settled, tierDiscardedP50s: [510] },
                "test row",
            ),
        ).toThrow("one finite positive p50 per discarded window")
        expect(() =>
            parseBenchmarkObservation(
                { ...settled, tierSettled: "yes" },
                "test row",
            ),
        ).toThrow("tierSettled must be a boolean")
        expect(() =>
            parseBenchmarkObservation(
                { ...result, tierWindows: 0 },
                "test row",
            ),
        ).toThrow("tierWindows must be a small positive integer")
    })

    test("pairs reordered observations by benchmark and pair ID", () => {
        const name = "async settle: selector resolve observed"
        const [base1, head1] = pair(name, "pair-1", 5_300, 10_300)
        const [base2, head2] = pair(name, "pair-2", 5_500, 6_800)
        const [base3, head3] = pair(name, "pair-3", 7_200, 8_400)
        const paired = toPairedBmf(
            // Files and lines are deliberately mixed: side metadata, not array
            // identity or position, determines each pair.
            [head3, base1, head2],
            [base3, head1, base2],
        )

        // Ratios are 1.943, 1.236, 1.167; the smallest is 8_400 / 7_200. Against
        // the separately uploaded 5_500ns base median that reports +16.7%.
        // Independent medians would incorrectly report +52.7%.
        expect(paired[name].latency.value).toBeCloseTo(5_500 * (8_400 / 7_200))
    })

    test("paired conversion rejects unsupported versioned observations", () => {
        const current = observation("set 1000 atoms / valdres", 250, {
            pairId: "pair-1",
            side: "base",
        })
        const future = {
            ...current,
            schemaVersion: BENCHMARK_RESULT_SCHEMA_VERSION + 1,
        } as unknown as BenchResult

        expect(() => toPairedBmf([future], [])).toThrow(
            `Paired benchmark conversion requires schemaVersion ${BENCHMARK_RESULT_SCHEMA_VERSION} observations`,
        )
    })

    test("a stall in most pairs cannot manufacture a regression", () => {
        const name = "set(atom, value) / valdres"
        // Real shape observed in one CI job: the head side was measured at
        // 131ns, 351ns, 131ns while the base side stayed flat. Two of three
        // pairs are contaminated, so a median would report ~+168% and alert.
        const paired = toPairedBmf(
            [
                pair(name, "pair-1", 131, 351)[0],
                pair(name, "pair-2", 131, 351)[0],
                pair(name, "pair-3", 131, 131)[0],
            ],
            [
                pair(name, "pair-1", 131, 351)[1],
                pair(name, "pair-2", 131, 351)[1],
                pair(name, "pair-3", 131, 131)[1],
            ],
        )

        // The clean pair wins: no change reported, no alert.
        expect(paired[name].latency.value).toBeCloseTo(131)
    })

    test("a genuine regression present in every pair still gates", () => {
        const name = "set(atom, value) / valdres"
        // A real same-runner regression shifts every pair, so even the least
        // contaminated one is over the +50% boundary this gate enforces.
        const paired = toPairedBmf(
            [
                pair(name, "pair-1", 100, 210)[0],
                pair(name, "pair-2", 100, 175)[0],
                pair(name, "pair-3", 100, 190)[0],
            ],
            [
                pair(name, "pair-1", 100, 210)[1],
                pair(name, "pair-2", 100, 175)[1],
                pair(name, "pair-3", 100, 190)[1],
            ],
        )

        expect(paired[name].latency.value).toBeCloseTo(175)
        expect(paired[name].latency.value).toBeGreaterThan(100 * 1.5)
    })

    test("fails closed on duplicate observations", () => {
        const name = "async settle: selector resolve observed"
        const [base, head] = pair(name, "pair-1", 5_300, 6_800)

        expect(() => toPairedBmf([base, base], [head])).toThrow(
            `Duplicate base observation for ${name} in pair pair-1`,
        )
    })

    test("fails closed when a paired observation is missing", () => {
        const name = "async settle: selector resolve observed"
        const base = observation(name, 5_300, {
            pairId: "pair-1",
            side: "base",
        })

        expect(() => toPairedBmf([base], [])).toThrow(
            `Missing head side for ${name} in pair pair-1`,
        )
    })

    test("validates diagnostics even when a benchmark is excluded from gating", () => {
        const name = "atom(1) / valdres"
        const base = observation(name, 5, {
            pairId: "pair-1",
            side: "base",
        })

        expect(() => toPairedBmf([base], [], { excludeTiny: true })).toThrow(
            `Missing head side for ${name} in pair pair-1`,
        )
    })

    test("fails closed on mismatched pair IDs", () => {
        const name = "async settle: selector resolve observed"
        const base = observation(name, 5_300, {
            pairId: "pair-1",
            side: "base",
        })
        const head = observation(name, 6_800, {
            pairId: "pair-2",
            side: "head",
        })

        expect(() => toPairedBmf([base], [head])).toThrow(
            `Mismatched pair IDs for ${name}: base=pair-1; head=pair-2`,
        )
    })

    test("fails closed on mixed runtime or suite metadata", () => {
        const name = "async settle: selector resolve observed"
        const [base, head] = pair(name, "pair-1", 5_300, 6_800)

        expect(() =>
            toPairedBmf([base], [{ ...head, runtime: "node" }]),
        ).toThrow("Inconsistent runtime/suite metadata for pair pair-1")
        expect(() =>
            toPairedBmf([base], [{ ...head, suite: "async" }]),
        ).toThrow("Inconsistent runtime/suite metadata for pair pair-1")
    })

    test("fails closed on invalid execution order metadata", () => {
        const name = "async settle: selector resolve observed"
        const [base, head] = pair(name, "pair-1", 5_300, 6_800)

        expect(() =>
            toPairedBmf([base], [{ ...head, order: base.order }]),
        ).toThrow("Invalid execution order metadata for pair pair-1")
    })

    test("fails closed on duplicate run identity", () => {
        const name = "async settle: selector resolve observed"
        const [base, head] = pair(name, "pair-1", 5_300, 6_800)

        expect(() =>
            toPairedBmf([base], [{ ...head, runId: base.runId }]),
        ).toThrow(`Duplicate run identity ${base.runId}`)
    })

    test("fails closed on incomplete process blocks", () => {
        const first = "async settle: selector resolve observed"
        const second = "async settle: atom resolve observed"
        const baseRun = "base-process"
        const base = [
            observation(first, 5_300, {
                pairId: "pair-1",
                side: "base",
                runId: baseRun,
            }),
            observation(second, 4_300, {
                pairId: "pair-1",
                side: "base",
                runId: baseRun,
            }),
        ]
        const head = [
            observation(first, 6_800, {
                pairId: "pair-1",
                side: "head",
                runId: "head-process-1",
            }),
            observation(second, 5_800, {
                pairId: "pair-1",
                side: "head",
                runId: "head-process-2",
                processId: 201,
            }),
        ]

        expect(() => toPairedBmf(base, head)).toThrow(
            "Incomplete process blocks for pair pair-1",
        )
    })

    test("gives legacy paired observations an explicit migration error", () => {
        const name = "async settle: selector resolve observed"

        expect(() =>
            toPairedBmf([latency(name, 5_300)], [latency(name, 6_800)]),
        ).toThrow(
            "Paired benchmark conversion requires schemaVersion 2 observations",
        )
    })
})
