import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { selectorFamily } from "../selectorFamily"
import { store } from "../store"
import type { Selector } from "../types/Selector"
import type { Store } from "../types/Store"
import { measureArchitecture } from "../../test/utils/measureArchitecture"
import { uniqueName } from "../../test/utils/uniqueName"

// A MATRIX gate on redundant selector work, not a fixture.
//
// Why this file exists: the beta.20 "selector re-evaluates on every dependency
// read" regression (see undefinedSelectorMemoization.test.ts) shipped even
// though this package already had (a) a `selectorEvaluations` counter, (b) the
// exact-count gate suite in architecturePerformance.test.ts, and (c) a
// head-to-head selector benchmark. None of them could see it:
//
//   - Correctness tests assert VALUES, and a redundant evaluation returns the
//     right value. The bug never produced a wrong answer, only ~100x the work.
//   - Every fixture in architecturePerformance.test.ts returned a DEFINED value
//     (0 of them returned `undefined`), and every multi-`get` body read
//     DIFFERENT dependencies (`get(left) + get(right)`) rather than the same one
//     twice. The bug needed both: a value that compares equal to the
//     absent-entry sentinel, AND a repeated read to multiply the cost.
//   - Same for the benchmarks: 0 fixtures returned `undefined`, so no timing
//     ever moved.
//
// A hand-written gate only catches regressions in a shape someone already
// imagined. So instead of adding the one shape we just learned about, this
// sweeps the PRODUCT of "what a selector returns" x "how the graph is read" and
// asserts the invariant that actually matters:
//
//   Reading a selector whose dependencies have not changed must not evaluate
//   anything. Full stop — regardless of what it returns, how it compares
//   values, how deep it sits, or whether it is live.
//
// Counting via the engine's own instrumentation (rather than a counter inside
// one fixture's body) means this also catches redundant evaluation of selectors
// the test never named.

// The values a selector can return that have historically confused
// change-detection. `undefined` is the one that broke: it is also the value
// `data.values.get(selector)` yields for an ABSENT entry.
const RETURN_VALUES: Array<[string, unknown]> = [
    ["undefined", undefined],
    ["null", null],
    ["zero", 0],
    ["false", false],
    ["NaN", NaN],
    ["empty string", ""],
    ["empty object", {}],
    ["empty array", []],
    ["number", 7],
]

const READS = 8

describe("selector memoization gate", () => {
    // --- 1. A settled read evaluates nothing, for every return value --------
    // The core invariant. If any return value makes a committed selector
    // re-evaluate on read, this fails for that value alone and names it.
    describe("a settled read evaluates nothing", () => {
        for (const [label, value] of RETURN_VALUES) {
            test(`returning ${label}`, () => {
                const source = atom(1, { name: uniqueName("gate-src") })
                const leaf = selector(
                    get => {
                        get(source)
                        return value
                    },
                    { name: uniqueName("gate-leaf") },
                )
                const root = selector(
                    get => {
                        let reads = 0
                        for (let i = 0; i < READS; i++) {
                            get(leaf)
                            reads++
                        }
                        return reads
                    },
                    { name: uniqueName("gate-root") },
                )

                const target = store()
                target.get(root) // settle
                const counts = measureArchitecture(target, () => {
                    for (let i = 0; i < READS; i++) target.get(root)
                })
                expect(counts.selectorEvaluations).toBe(0)
            })
        }
    })

    // --- 2. One repeated-read pass evaluates each node once -----------------
    // The multiplier. A cold read of a graph where every level reads its child
    // READS times must cost one evaluation per NODE, never per READ.
    describe("a cold read costs one evaluation per node", () => {
        for (const [label, value] of RETURN_VALUES) {
            test(`returning ${label}`, () => {
                const source = atom(1, { name: uniqueName("gate-src") })
                const leaf = selector(
                    get => {
                        get(source)
                        return value
                    },
                    { name: uniqueName("gate-leaf") },
                )
                const middle = selector(
                    get => {
                        for (let i = 0; i < READS; i++) get(leaf)
                        return value
                    },
                    { name: uniqueName("gate-middle") },
                )
                const root = selector(
                    get => {
                        for (let i = 0; i < READS; i++) get(middle)
                        return 1
                    },
                    { name: uniqueName("gate-root") },
                )

                const target = store()
                const counts = measureArchitecture(target, () =>
                    target.get(root),
                )
                // 3 nodes. Without memoization this is
                // READS^2 + READS + 1 = 73 for READS = 8.
                expect(counts.selectorEvaluations).toBe(3)
            })
        }
    })

    // --- 3. A write re-evaluates only what it has to ------------------------
    // The bug hit writes as well as reads: re-evaluating a dependent re-read
    // its child once per `get()`. Here the leaf's value does not depend on the
    // written atom, so the write must cost exactly ONE evaluation — the leaf's
    // — and stop there, because its value is unchanged.
    describe("a write re-evaluates only what it has to", () => {
        for (const [label, value] of RETURN_VALUES) {
            test(`returning ${label}`, () => {
                const source = atom(1, { name: uniqueName("gate-src") })
                const leaf = selector(
                    get => {
                        get(source)
                        return value
                    },
                    { name: uniqueName("gate-leaf") },
                )
                const root = selector(
                    get => {
                        let reads = 0
                        for (let i = 0; i < READS; i++) {
                            get(leaf)
                            reads++
                        }
                        return reads
                    },
                    { name: uniqueName("gate-root") },
                )

                const target = store()
                target.sub(root, () => {})
                const counts = measureArchitecture(target, () =>
                    target.set(source, 2),
                )
                // The leaf alone, once. Before the fix a write cost one leaf
                // re-evaluation per `get(leaf)` in the dependent's body.
                expect(counts.selectorEvaluations).toBe(1)
            })
        }
    })

    // --- 4. The read shape must not matter ---------------------------------
    // Same graph, same assertion, read four ways. A memoization hole that only
    // shows up when the parent is live, or only inside a scope, is still a
    // memoization hole.
    // `open` returns the handle the assertions read through — the root store
    // for the plain modes, the scope for the scoped ones. `measureArchitecture`
    // attaches to the whole tree either way.
    const READ_MODES: Array<
        [string, (root: Store, target: Selector<unknown>) => Store]
    > = [
        [
            "cold get",
            (root, target) => {
                root.get(target)
                return root
            },
        ],
        [
            "subscribed",
            (root, target) => {
                root.sub(target, () => {})
                return root
            },
        ],
        [
            "scope get",
            (root, target) => {
                const scoped = root.scope("gate-scope")
                scoped.get(target)
                return scoped
            },
        ],
        [
            "scope subscribed",
            (root, target) => {
                const scoped = root.scope("gate-scope")
                scoped.sub(target, () => {})
                return scoped
            },
        ],
    ]

    describe("undefined leaf, one evaluation per node in every read mode", () => {
        for (const [modeLabel, open] of READ_MODES) {
            test(modeLabel, () => {
                const source = atom(1, { name: uniqueName("gate-src") })
                const leaf = selector(
                    get => {
                        get(source)
                        return undefined
                    },
                    { name: uniqueName("gate-leaf") },
                )
                const root = selector(
                    get => {
                        let reads = 0
                        for (let i = 0; i < READS; i++) {
                            get(leaf)
                            reads++
                        }
                        return reads
                    },
                    { name: uniqueName("gate-root") },
                )

                const target = store()
                let handle!: Store
                const cold = measureArchitecture(target, () => {
                    handle = open(target, root as Selector<unknown>)
                })
                // leaf + root, whichever store the read landed in.
                expect(cold.selectorEvaluations).toBe(2)

                const settled = measureArchitecture(target, () => {
                    for (let i = 0; i < READS; i++) handle.get(root)
                })
                expect(settled.selectorEvaluations).toBe(0)
            })
        }
    })

    // --- 5. selectorFamily members are memoized per member -----------------
    // The reported shape: a traversal revisiting shared leaf members.
    test("a traversal revisiting shared family members evaluates each once", () => {
        const refs = ["a", "b", "c", "d"]
        const duration = selectorFamily<undefined, [string]>(
            () => () => undefined,
            { name: uniqueName("gate-duration") },
        )
        const total = selector(
            get => {
                let reads = 0
                for (let i = 0; i < READS; i++) {
                    for (const ref of refs) {
                        get(duration(ref))
                        reads++
                    }
                }
                return reads
            },
            { name: uniqueName("gate-total") },
        )

        const target = store()
        const cold = measureArchitecture(target, () => target.get(total))
        // One per member plus `total`. Without memoization:
        // refs.length * READS + 1 = 33.
        expect(cold.selectorEvaluations).toBe(refs.length + 1)

        const settled = measureArchitecture(target, () => {
            for (let i = 0; i < READS; i++) target.get(total)
        })
        expect(settled.selectorEvaluations).toBe(0)
    })

    // --- 6. A lenient custom `equal` must not disable memoization ----------
    // `equal: () => true` reported the first computed value equal to the absent
    // entry too, so this shape lost memoization for EVERY return value, not
    // just `undefined`.
    test("a custom equal that accepts anything still memoizes", () => {
        const source = atom(1, { name: uniqueName("gate-src") })
        const leaf = selector(get => get(source), {
            name: uniqueName("gate-leaf"),
            equal: () => true,
        })
        const root = selector(
            get => {
                let reads = 0
                for (let i = 0; i < READS; i++) {
                    get(leaf)
                    reads++
                }
                return reads
            },
            { name: uniqueName("gate-root") },
        )

        const target = store()
        const cold = measureArchitecture(target, () => target.get(root))
        expect(cold.selectorEvaluations).toBe(2)

        const settled = measureArchitecture(target, () => {
            for (let i = 0; i < READS; i++) target.get(root)
        })
        expect(settled.selectorEvaluations).toBe(0)
    })

    // --- 7. The comparator is a matrix AXIS, not a single case --------------
    // Section 6 above covered "a custom equal" with exactly one variant:
    // `equal: () => true`. That variant is null-safe BY CONSTRUCTION — it
    // ignores both operands — so it is the one custom comparator that cannot
    // observe what it is handed. Having the dimension present but populated
    // with a non-exercising variant bought false confidence: Copilot found on
    // PR #329 that both change-detection sites invoked `equal` with the
    // absent-entry sentinel, which `EqualFunc<Value>` says cannot happen, so a
    // perfectly ordinary `(a, b) => a.id === b.id` crashed on a first read.
    // Section 6 sailed straight past it.
    //
    // So sweep the comparator too, with variants that actually DEREFERENCE
    // their operands. The lesson generalizes past this bug: when a matrix gains
    // a user-supplied-callback axis, the variants have to exercise the
    // contract, not merely occupy the slot.
    type Row = { id: number }
    const COMPARATORS: Array<
        [string, ((a: Row, b: Row) => boolean) | undefined]
    > = [
        ["default structural equal", undefined],
        ["reads a.id and b.id", (a, b) => a.id === b.id],
        ["reference identity", (a, b) => a === b],
        [
            "reads a.id via Object.keys",
            (a, b) => Object.keys(a).length === Object.keys(b).length,
        ],
        ["lenient, ignores operands", () => true],
    ]

    describe("an object-valued selector, swept by comparator", () => {
        for (const [label, equal] of COMPARATORS) {
            test(label, () => {
                const source = atom(1, { name: uniqueName("gate-src") })
                const leaf = selector<Row>(get => ({ id: get(source) }), {
                    name: uniqueName("gate-leaf"),
                    ...(equal ? { equal } : {}),
                })
                const root = selector(
                    get => {
                        let reads = 0
                        for (let i = 0; i < READS; i++) {
                            get(leaf).id
                            reads++
                        }
                        return reads
                    },
                    { name: uniqueName("gate-root") },
                )

                const target = store()
                // A dereferencing comparator must survive the FIRST read: it
                // used to be handed `undefined` and throw here.
                const cold = measureArchitecture(target, () =>
                    expect(target.get(root)).toBe(READS),
                )
                expect(cold.selectorEvaluations).toBe(2)

                const settled = measureArchitecture(target, () => {
                    for (let i = 0; i < READS; i++) target.get(root)
                })
                expect(settled.selectorEvaluations).toBe(0)
            })
        }
    })

    describe("a dereferencing comparator in every read mode", () => {
        for (const [modeLabel, open] of READ_MODES) {
            test(modeLabel, () => {
                const source = atom(1, { name: uniqueName("gate-src") })
                const leaf = selector<Row>(get => ({ id: get(source) }), {
                    name: uniqueName("gate-leaf"),
                    equal: (a, b) => a.id === b.id,
                })
                const root = selector(
                    get => {
                        let reads = 0
                        for (let i = 0; i < READS; i++) {
                            get(leaf).id
                            reads++
                        }
                        return reads
                    },
                    { name: uniqueName("gate-root") },
                )

                const target = store()
                let handle!: Store
                const cold = measureArchitecture(target, () => {
                    handle = open(target, root as unknown as Selector<unknown>)
                })
                expect(cold.selectorEvaluations).toBe(2)
                expect(handle.get(root)).toBe(READS)

                const settled = measureArchitecture(target, () => {
                    for (let i = 0; i < READS; i++) handle.get(root)
                })
                expect(settled.selectorEvaluations).toBe(0)
            })
        }
    })
})
