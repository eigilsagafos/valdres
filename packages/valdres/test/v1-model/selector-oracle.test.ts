import { describe, expect, test } from "bun:test"
import { value, type ValueToken } from "./protocol"
import {
    createSelectorOracle,
    selectorTokenObjectIs,
    type SelectorOracleError,
    type SelectorOracleOutcome,
} from "./selector-oracle"

function valueOutcome(outcome: SelectorOracleOutcome): ValueToken {
    expect(outcome.kind).toBe("value")
    return (outcome as Extract<SelectorOracleOutcome, { kind: "value" }>).value
}

function errorOutcome(outcome: SelectorOracleOutcome): SelectorOracleError {
    expect(outcome.kind).toBe("error")
    return (outcome as Extract<SelectorOracleOutcome, { kind: "error" }>).error
}

function booleanToken(token: ValueToken): boolean {
    expect(token.kind).toBe("boolean")
    return (token as Extract<ValueToken, { kind: "boolean" }>).value
}

describe("v1 symbolic selector oracle", () => {
    test("V1M-SEL-ORACLE-001 models Object.is over tagged values", () => {
        const sameObject = value.identity("object", "shared")
        const comparisons = [
            [value.undefined, value.undefined, true],
            [value.undefined, value.null, false],
            [value.number(Number.NaN), value.number(Number.NaN), true],
            [value.number(-0), value.number(0), false],
            [value.bigint(7n), value.bigint(7n), true],
            [sameObject, value.identity("object", "shared"), true],
            [sameObject, value.identity("array", "shared"), false],
            [sameObject, value.identity("object", "other"), false],
        ] as const

        for (const [left, right, expected] of comparisons) {
            expect(selectorTokenObjectIs(left, right)).toBe(expected)
        }
    })

    test("V1M-SEL-ORACLE-002 exhausts dynamic branches with ordered deduped graph replacement", () => {
        const oracle = createSelectorOracle([
            {
                kind: "leaf",
                id: "gate",
                state: { kind: "value", value: value.boolean(false) },
            },
            {
                kind: "leaf",
                id: "prefix",
                state: { kind: "value", value: value.string("prefix") },
            },
            {
                kind: "leaf",
                id: "left",
                state: { kind: "value", value: value.number(0) },
            },
            {
                kind: "leaf",
                id: "right",
                state: { kind: "value", value: value.number(0) },
            },
            {
                kind: "selector",
                id: "choice",
                get: get => {
                    const gate = booleanToken(get("gate"))
                    get("prefix")
                    const selected = get(gate ? "left" : "right")
                    get("prefix")
                    get(gate ? "left" : "right")
                    return selected
                },
            },
        ])

        let cases = 0
        for (const gate of [false, true]) {
            for (const left of [1, 2]) {
                for (const right of [10, 20]) {
                    cases += 1
                    oracle.setLeafValue("gate", value.boolean(gate))
                    oracle.setLeafValue("left", value.number(left))
                    oracle.setLeafValue("right", value.number(right))

                    const evaluation = oracle.evaluate("choice")
                    expect(evaluation.dependencies).toEqual([
                        "gate",
                        "prefix",
                        gate ? "left" : "right",
                    ])
                    expect(valueOutcome(evaluation.outcome)).toEqual(
                        value.number(gate ? left : right),
                    )
                }
            }
        }
        expect(cases).toBe(8)
    })

    test("V1M-SEL-ORACLE-003 freezes the dependency prefix when a getter catches its direct cycle", () => {
        let afterEvaluations = 0
        const oracle = createSelectorOracle([
            {
                kind: "leaf",
                id: "prefix",
                state: { kind: "value", value: value.string("prefix") },
            },
            {
                kind: "selector",
                id: "after",
                get: () => {
                    afterEvaluations += 1
                    return value.string("after")
                },
            },
            {
                kind: "selector",
                id: "self",
                get: get => {
                    get("prefix")
                    try {
                        get("self")
                    } catch {}
                    try {
                        get("after")
                    } catch {}
                    return value.string("caught")
                },
            },
        ])

        const evaluation = oracle.evaluate("self")
        expect(evaluation.dependencies).toEqual(["prefix"])
        expect(afterEvaluations).toBe(0)
        expect(errorOutcome(evaluation.outcome)).toEqual({
            kind: "cycle",
            selector: "self",
            dependency: "self",
            path: ["self", "self"],
        })
    })

    test("V1M-SEL-ORACLE-004 excludes an indirect cycle's offending edge and replaces the graph after repair", () => {
        let cyclic = true
        const oracle = createSelectorOracle([
            {
                kind: "leaf",
                id: "prefix",
                state: { kind: "value", value: value.number(1) },
            },
            {
                kind: "leaf",
                id: "safe",
                state: { kind: "value", value: value.string("safe") },
            },
            {
                kind: "selector",
                id: "a",
                get: get => get("b"),
            },
            {
                kind: "selector",
                id: "b",
                get: get => {
                    get("prefix")
                    return get(cyclic ? "a" : "safe")
                },
            },
        ])

        const failed = oracle.evaluate("a")
        expect(failed.dependencies).toEqual(["b"])
        expect(errorOutcome(failed.outcome)).toMatchObject({
            kind: "dependency",
            selector: "a",
            dependency: "b",
            cause: {
                kind: "cycle",
                selector: "b",
                dependency: "a",
                path: ["a", "b", "a"],
            },
        })
        expect(oracle.record("b")?.dependencies).toEqual(["prefix"])

        cyclic = false
        const recovered = oracle.evaluate("a")
        expect(valueOutcome(recovered.outcome)).toEqual(value.string("safe"))
        expect(recovered.dependencies).toEqual(["b"])
        expect(oracle.record("b")?.dependencies).toEqual(["prefix", "safe"])
    })

    test("V1M-SEL-ORACLE-005 assigns a dynamic reversal cycle to the new offending edge", () => {
        let selectorReadsDependency = false
        const oracle = createSelectorOracle([
            {
                kind: "leaf",
                id: "source",
                state: { kind: "value", value: value.number(1) },
            },
            {
                kind: "selector",
                id: "selector",
                get: get =>
                    get(selectorReadsDependency ? "dependent" : "source"),
            },
            {
                kind: "selector",
                id: "dependent",
                get: get => get("selector"),
            },
        ])

        expect(valueOutcome(oracle.evaluate("dependent").outcome)).toEqual(
            value.number(1),
        )
        expect(oracle.record("dependent")?.dependencies).toEqual(["selector"])

        selectorReadsDependency = true
        const reversed = oracle.evaluate("selector", {
            current: ["dependent"],
        })
        expect(reversed.dependencies).toEqual([])
        expect(errorOutcome(reversed.outcome)).toEqual({
            kind: "cycle",
            selector: "selector",
            dependency: "dependent",
            path: ["selector", "dependent", "selector"],
        })
        expect(oracle.record("dependent")?.dependencies).toEqual(["selector"])
    })

    test("V1M-SEL-ORACLE-006 separates dependency errors, caught read errors, and getter errors", () => {
        const getterFault = Object.freeze({ code: "GETTER_FAILED" })
        const oracle = createSelectorOracle([
            {
                kind: "leaf",
                id: "bad-leaf",
                state: { kind: "error", code: "LEAF_FAILED" },
            },
            {
                kind: "leaf",
                id: "prefix",
                state: { kind: "value", value: value.number(1) },
            },
            {
                kind: "selector",
                id: "uncaught",
                get: get => get("bad-leaf"),
            },
            {
                kind: "selector",
                id: "caught",
                get: get => {
                    try {
                        get("bad-leaf")
                    } catch {
                        return value.string("fallback")
                    }
                    return value.string("unreachable")
                },
            },
            {
                kind: "selector",
                id: "getter-error",
                get: get => {
                    get("prefix")
                    throw getterFault
                },
            },
        ])

        expect(errorOutcome(oracle.evaluate("uncaught").outcome)).toEqual({
            kind: "dependency",
            selector: "uncaught",
            dependency: "bad-leaf",
            cause: {
                kind: "leaf",
                node: "bad-leaf",
                code: "LEAF_FAILED",
            },
        })

        const caught = oracle.evaluate("caught")
        expect(valueOutcome(caught.outcome)).toEqual(value.string("fallback"))
        expect(caught.dependencies).toEqual(["bad-leaf"])

        const getterError = oracle.evaluate("getter-error")
        expect(getterError.dependencies).toEqual(["prefix"])
        expect(errorOutcome(getterError.outcome)).toEqual({
            kind: "getter",
            selector: "getter-error",
            thrown: getterFault,
        })
    })

    test("V1M-SEL-ORACLE-007 comparator true reuses the last success while accepting new dependencies", () => {
        let compareCalls = 0
        const oracle = createSelectorOracle([
            {
                kind: "leaf",
                id: "gate",
                state: { kind: "value", value: value.boolean(true) },
            },
            {
                kind: "leaf",
                id: "left",
                state: {
                    kind: "value",
                    value: value.identity("object", "left"),
                },
            },
            {
                kind: "leaf",
                id: "right",
                state: {
                    kind: "value",
                    value: value.identity("object", "right"),
                },
            },
            {
                kind: "selector",
                id: "stable",
                get: get => {
                    const gate = booleanToken(get("gate"))
                    return get(gate ? "left" : "right")
                },
                equal: () => {
                    compareCalls += 1
                    return true
                },
            },
        ])

        const first = oracle.evaluate("stable")
        const firstValue = valueOutcome(first.outcome)
        expect(first.dependencies).toEqual(["gate", "left"])
        expect(first.canonicalized).toBeFalse()
        expect(compareCalls).toBe(0)

        oracle.setLeafError("left", "TEMPORARY_FAILURE")
        const failed = oracle.evaluate("stable")
        expect(errorOutcome(failed.outcome)).toMatchObject({
            kind: "dependency",
            dependency: "left",
        })
        expect(oracle.lastSuccessfulValue("stable")).toBe(firstValue)
        expect(compareCalls).toBe(0)

        oracle.setLeafValue("gate", value.boolean(false))
        const second = oracle.evaluate("stable")
        expect(valueOutcome(second.outcome)).toBe(firstValue)
        expect(second.dependencies).toEqual(["gate", "right"])
        expect(second.canonicalized).toBeTrue()
        expect(oracle.lastSuccessfulValue("stable")).toBe(firstValue)
        expect(compareCalls).toBe(1)
    })

    test("V1M-SEL-ORACLE-008 default comparison canonicalizes NaN but distinguishes signed zero", () => {
        let candidate = Number.NaN
        const oracle = createSelectorOracle([
            {
                kind: "selector",
                id: "number",
                get: () => value.number(candidate),
            },
        ])

        const firstValue = valueOutcome(oracle.evaluate("number").outcome)
        const nanAgain = oracle.evaluate("number")
        expect(valueOutcome(nanAgain.outcome)).toBe(firstValue)
        expect(nanAgain.canonicalized).toBeTrue()

        candidate = -0
        const negativeZero = oracle.evaluate("number")
        expect(negativeZero.canonicalized).toBeFalse()
        const negativeZeroValue = valueOutcome(negativeZero.outcome)

        candidate = 0
        const positiveZero = oracle.evaluate("number")
        expect(positiveZero.canonicalized).toBeFalse()
        expect(valueOutcome(positiveZero.outcome)).not.toBe(negativeZeroValue)
    })
})
