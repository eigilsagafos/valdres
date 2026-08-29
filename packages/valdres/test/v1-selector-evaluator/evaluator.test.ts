import { describe, expect, test } from "bun:test"
import {
    InvalidSelectorComparatorResultError,
    InvalidSynchronousSelectorResultError,
    SelectorCircularDependencyError,
    SelectorComparatorError,
    SelectorDependencyError,
    SelectorGetterError,
    SelectorReadRevokedError,
} from "../../src/v1-internal/selector-evaluator/errors"
import { evaluateSelector } from "../../src/v1-internal/selector-evaluator/evaluate"
import type {
    SelectorComparisonBaseline,
    SelectorDefinition,
    SelectorEvaluationHost,
    SelectorEvaluationProposal,
    SelectorRecordView,
    ServedSelectorOutcome,
} from "../../src/v1-internal/selector-evaluator/types"
import { SelectorEvaluationSession } from "../../src/v1-internal/selector-evaluator/types"
import { value } from "../v1-model/protocol"
import { createSelectorOracle } from "../v1-model/selector-oracle"

type Node = string
type Token = Readonly<{ id: number }>

interface TestRecord {
    readonly served: ServedSelectorOutcome<Token>
    readonly dependencies: SelectorRecordView<Node, Token>["dependencies"]
    readonly lastSuccess: Readonly<{ value: unknown; token: Token }> | undefined
}

type HostMode = "persistent-pre" | "persistent-post" | "scratch" | "hydration"

class TestHost implements SelectorEvaluationHost<Node, Token> {
    readonly definitions = new Map<Node, SelectorDefinition<Node>>()
    readonly leaves = new Map<Node, ServedSelectorOutcome<Token>>()
    readonly records = new Map<Node, TestRecord>()
    readonly dirty = new Set<Node>()
    readonly evaluations = new Map<Node, number>()
    readonly leafReads = new Map<Node, number>()
    readonly publications: SelectorEvaluationProposal<Node, Token>[] = []
    readonly liveRecords: Map<Node, TestRecord> | undefined
    readonly comparisonRecords: Map<Node, TestRecord> | undefined
    #nextToken = 1
    #activeSession: SelectorEvaluationSession<Node> | undefined
    #disposed = false

    constructor(
        readonly mode: HostMode = "persistent-pre",
        options: Readonly<{
            liveRecords?: Map<Node, TestRecord>
            comparisonRecords?: Map<Node, TestRecord>
        }> = {},
    ) {
        this.liveRecords = options.liveRecords
        this.comparisonRecords = options.comparisonRecords
    }

    define<Value>(definition: SelectorDefinition<Node, Value>): void {
        this.definitions.set(
            definition.node,
            definition as SelectorDefinition<Node>,
        )
        this.dirty.add(definition.node)
    }

    setLeaf<Value>(node: Node, value: Value): void {
        this.leaves.set(node, {
            token: this.createOutcomeToken(),
            outcome: Object.freeze({ kind: "value", value }),
        })
        for (const selector of this.definitions.keys()) this.dirty.add(selector)
    }

    setLeafError(node: Node, error: unknown): void {
        this.leaves.set(node, {
            token: this.createOutcomeToken(),
            outcome: Object.freeze({ kind: "error", error }),
        })
        for (const selector of this.definitions.keys()) this.dirty.add(selector)
    }

    setControlLeaf(node: Node, error: unknown): void {
        this.leaves.set(node, {
            token: this.createOutcomeToken(),
            outcome: Object.freeze({ kind: "control-error", error }),
        })
        for (const selector of this.definitions.keys()) this.dirty.add(selector)
    }

    markDirty(...nodes: Node[]): void {
        for (const node of nodes) this.dirty.add(node)
    }

    read<Value = unknown>(node: Node): ServedSelectorOutcome<Token, Value> {
        if (this.#disposed) throw new Error("host disposed")
        return this.serve(
            node,
            new SelectorEvaluationSession<Node>(),
        ) as ServedSelectorOutcome<Token, Value>
    }

    serve(
        node: Node,
        session: SelectorEvaluationSession<Node>,
    ): ServedSelectorOutcome<Token, unknown> {
        if (this.#disposed) throw new Error("host disposed")
        const leaf = this.leaves.get(node)
        if (leaf) {
            this.leafReads.set(node, (this.leafReads.get(node) ?? 0) + 1)
            if (leaf.outcome.kind === "control-error") {
                session.latchControlFault(leaf.outcome.error)
                throw leaf.outcome.error
            }
            return leaf
        }

        const definition = this.definitions.get(node)
        if (!definition) {
            const error = Object.freeze({ code: "MISSING_SERVER_READER" })
            session.latchControlFault(error)
            throw error
        }

        const current = this.records.get(node)
        if (current && !this.dirty.has(node)) {
            return current.served
        }

        this.evaluations.set(node, (this.evaluations.get(node) ?? 0) + 1)
        const previousSession = this.#activeSession
        this.#activeSession = session
        let proposal: SelectorEvaluationProposal<Node, Token>
        try {
            proposal = evaluateSelector(definition, this, session)
        } finally {
            this.#activeSession = previousSession
        }

        if (
            proposal.outcome.kind === "control-error" &&
            this.mode !== "persistent-post"
        ) {
            throw proposal.outcome.error
        }

        const previous = this.records.get(node)
        const served = Object.freeze({
            token: proposal.token,
            outcome: proposal.outcome,
        })
        const record: TestRecord = Object.freeze({
            served,
            dependencies: proposal.dependencies,
            lastSuccess:
                proposal.outcome.kind === "value"
                    ? Object.freeze({
                          value: proposal.outcome.value,
                          token: proposal.token,
                      })
                    : previous?.lastSuccess,
        })
        this.records.set(node, record)
        this.dirty.delete(node)
        this.publications.push(proposal)
        return served
    }

    getSelectorRecord(node: Node): SelectorRecordView<Node, Token> | undefined {
        const record = this.records.get(node)
        return record
            ? Object.freeze({ dependencies: record.dependencies })
            : undefined
    }

    getComparisonBaseline(
        node: Node,
    ): SelectorComparisonBaseline<Token, unknown> | undefined {
        if (this.mode === "hydration") return undefined
        const record =
            this.records.get(node) ?? this.comparisonRecords?.get(node)
        if (!record?.lastSuccess) return undefined
        return record.served.outcome.kind === "value"
            ? Object.freeze({
                  current: true,
                  value: record.lastSuccess.value,
                  token: record.served.token,
              })
            : Object.freeze({
                  current: false,
                  value: record.lastSuccess.value,
              })
    }

    createOutcomeToken(): Token {
        return Object.freeze({ id: this.#nextToken++ })
    }

    raiseControl(error: unknown): never {
        if (!this.#activeSession) throw new Error("no active selector callback")
        this.#activeSession.latchControlFault(error)
        throw error
    }

    dispose(): void {
        this.#disposed = true
        this.records.clear()
        this.dirty.clear()
    }
}

const valueOf = <Value>(served: ServedSelectorOutcome<Token, Value>): Value => {
    if (served.outcome.kind !== "value") throw served.outcome.error
    return served.outcome.value
}

const errorOf = (served: ServedSelectorOutcome<Token>): unknown => {
    if (served.outcome.kind === "value") {
        throw new Error("expected an error outcome")
    }
    return served.outcome.error
}

describe("v1 selector evaluator outcomes", () => {
    test("V1M-SEL-001 captures first-read-ordered deduplicated dependencies and memoizes in the host", () => {
        const host = new TestHost()
        host.setLeaf("a", 2)
        host.setLeaf("b", 3)
        host.define({
            node: "sum",
            get: get => get<number>("a") + get<number>("b") + get<number>("a"),
        })

        const first = host.read<number>("sum")
        const second = host.read<number>("sum")

        expect(valueOf(first)).toBe(7)
        expect(second).toBe(first)
        expect(host.evaluations.get("sum")).toBe(1)
        expect(
            host.records.get("sum")?.dependencies.map(({ node }) => node),
        ).toEqual(["a", "b"])
    })

    test("V1M-SEL-002 custom equality reuses a current value token while replacing topology", () => {
        const host = new TestHost()
        const stable = Object.freeze({ count: 1 })
        host.setLeaf("left", 1)
        host.setLeaf("right", 1)
        let useLeft = true
        let comparisons = 0
        host.define({
            node: "derived",
            get: get => {
                get(useLeft ? "left" : "right")
                return Object.freeze({ count: 1 })
            },
            equal: (previous, next) => {
                comparisons++
                return previous.count === next.count
            },
        })

        const first = host.read<{ count: number }>("derived")
        expect(valueOf(first)).toEqual(stable)
        useLeft = false
        host.markDirty("derived")
        const second = host.read<{ count: number }>("derived")

        expect(second.token).toBe(first.token)
        expect(valueOf(second)).toBe(valueOf(first))
        expect(comparisons).toBe(1)
        expect(host.records.get("derived")?.dependencies[0]?.node).toBe("right")
    })

    test("an equal last-good recovery gets a new observable token", () => {
        const host = new TestHost()
        let fail = false
        host.define({
            node: "derived",
            get: () => {
                if (fail) throw new Error("boom")
                return 1
            },
        })
        const value = host.read("derived")
        fail = true
        host.markDirty("derived")
        const error = host.read("derived")
        fail = false
        host.markDirty("derived")
        const recovered = host.read("derived")

        expect(errorOf(error)).toBeInstanceOf(SelectorGetterError)
        expect(valueOf(recovered)).toBe(1)
        expect(recovered.token).not.toBe(value.token)
        expect(recovered.token).not.toBe(error.token)
    })

    test("a nested child remains current when its parent proposal fails", () => {
        const host = new TestHost()
        host.setLeaf("leaf", 4)
        host.define({ node: "child", get: get => get<number>("leaf") * 2 })
        host.define({
            node: "parent",
            get: get => {
                get("child")
                throw new Error("parent")
            },
        })

        const parent = host.read("parent")
        expect(errorOf(parent)).toBeInstanceOf(SelectorGetterError)
        expect(valueOf(host.read<number>("child"))).toBe(8)
        expect(host.evaluations.get("child")).toBe(1)
    })

    test("an ordinary dependency error is captured before it is served", () => {
        const cause = new Error("leaf failed")
        const host = new TestHost()
        host.setLeafError("bad", cause)
        host.define({ node: "parent", get: get => get("bad") })

        const error = errorOf(host.read("parent"))
        expect(error).toBeInstanceOf(SelectorGetterError)
        expect((error as SelectorGetterError).cause).toBeInstanceOf(
            SelectorDependencyError,
        )
        expect(
            host.records.get("parent")?.dependencies.map(({ node }) => node),
        ).toEqual(["bad"])
    })

    test("proposals and their dependency carriers are immutable", () => {
        const host = new TestHost()
        host.setLeaf("leaf", 1)
        host.define({ node: "derived", get: get => get("leaf") })
        host.read("derived")
        const proposal = host.publications.at(-1)!

        expect(Object.isFrozen(proposal)).toBe(true)
        expect(Object.isFrozen(proposal.outcome)).toBe(true)
        expect(Object.isFrozen(proposal.dependencies)).toBe(true)
        expect(Object.isFrozen(proposal.dependencies[0])).toBe(true)
        expect(Object.isFrozen(proposal.attemptedPrefix)).toBe(true)
        expect(() =>
            (proposal.dependencies as { node: string; token: Token }[]).push({
                node: "other",
                token: { id: 99 },
            }),
        ).toThrow()
    })
})

describe("v1 selector evaluator cycles", () => {
    test("V1M-SEL-003 direct recursion installs a cycle error with no offending edge", () => {
        const host = new TestHost()
        host.define({ node: "self", get: get => get("self") })

        const served = host.read("self")
        expect(errorOf(served)).toBeInstanceOf(SelectorCircularDependencyError)
        expect(host.records.get("self")?.dependencies).toEqual([])
    })

    test("indirect recursion assigns the cycle to the offending child and keeps a DAG", () => {
        const host = new TestHost()
        host.define({ node: "a", get: get => get("b") })
        host.define({ node: "b", get: get => get("a") })

        const served = host.read("a")
        expect(errorOf(host.records.get("b")!.served)).toBeInstanceOf(
            SelectorCircularDependencyError,
        )
        expect(host.records.get("b")?.dependencies).toEqual([])
        expect(errorOf(served)).toBeInstanceOf(SelectorGetterError)
        expect(
            host.records.get("a")?.dependencies.map(({ node }) => node),
        ).toEqual(["b"])
    })

    test("a caught cycle freezes the prefix before any later supplied read", () => {
        const host = new TestHost()
        let afterEvaluations = 0
        host.setLeaf("prefix", 1)
        host.define({
            node: "after",
            get: () => {
                afterEvaluations++
                return 2
            },
        })
        host.define({
            node: "self",
            get: get => {
                get("prefix")
                try {
                    get("self")
                } catch {}
                try {
                    get("after")
                } catch {}
                return 3
            },
        })

        const served = host.read("self")
        expect(errorOf(served)).toBeInstanceOf(SelectorCircularDependencyError)
        expect(
            host.records.get("self")?.dependencies.map(({ node }) => node),
        ).toEqual(["prefix"])
        expect(afterEvaluations).toBe(0)
    })

    test("cached dynamic cycles exclude the newly offending edge", () => {
        const host = new TestHost()
        host.setLeaf("leaf", 1)
        host.define({ node: "a", get: get => get("leaf") })
        host.define({ node: "b", get: get => get("a") })
        host.read("b")

        host.define({ node: "a", get: get => get("b") })
        const served = host.read("a")

        expect(errorOf(served)).toBeInstanceOf(SelectorCircularDependencyError)
        expect(host.records.get("a")?.dependencies).toEqual([])
        expect(host.records.get("b")?.dependencies[0]?.node).toBe("a")
    })

    test("cached multi-hop cycles report the actual authoritative path", () => {
        const host = new TestHost()
        host.setLeaf("leaf", 1)
        host.define({ node: "a", get: get => get("leaf") })
        host.define({ node: "c", get: get => get("a") })
        host.define({ node: "b", get: get => get("c") })
        host.read("b")

        host.define({ node: "a", get: get => get("b") })
        const error = errorOf(host.read("a"))

        expect(error).toBeInstanceOf(SelectorCircularDependencyError)
        expect((error as SelectorCircularDependencyError).path).toEqual([
            "a",
            "b",
            "c",
            "a",
        ])
        expect(host.records.get("a")?.dependencies).toEqual([])
    })

    for (const [name, first, second] of [
        ["a-to-b becomes b-to-a", "a", "b"],
        ["b-to-a becomes a-to-b", "b", "a"],
    ] as const) {
        test(`makes the dependency current before checking a valid reversal: ${name}`, () => {
            const host = new TestHost()
            host.setLeaf("leaf", 1)
            host.define({ node: second, get: get => get("leaf") })
            host.define({ node: first, get: get => get(second) })
            host.read(first)

            host.define({ node: first, get: get => get("leaf") })
            host.define({ node: second, get: get => get(first) })
            const served = host.read<number>(second)

            expect(valueOf(served)).toBe(1)
            expect(host.records.get(first)?.dependencies[0]?.node).toBe("leaf")
            expect(host.records.get(second)?.dependencies[0]?.node).toBe(first)
        })
    }
})

describe("v1 selector evaluator faults and revocation", () => {
    test("V1M-SEL-004 a caught control fault wins and excludes its foreign edge", () => {
        const mismatch = Object.freeze({
            code: "VALDRES_RUNTIME_MISMATCH",
        })
        const host = new TestHost("persistent-post")
        host.setLeaf("good", 1)
        host.setControlLeaf("foreign", mismatch)
        host.define({
            node: "derived",
            get: get => {
                get("good")
                try {
                    get("foreign")
                } catch {}
                return 2
            },
        })

        const served = host.read("derived")
        expect(served.outcome).toEqual({
            kind: "control-error",
            error: mismatch,
        })
        expect(
            host.records.get("derived")?.dependencies.map(({ node }) => node),
        ).toEqual(["good"])
    })

    test("post-apply control replaces stale current state but preserves last success and valid routing", () => {
        const mismatch = Object.freeze({
            code: "VALDRES_RUNTIME_MISMATCH",
        })
        const host = new TestHost("persistent-post")
        host.setLeaf("good", 1)
        host.define({ node: "derived", get: () => 1 })
        const previous = host.read<number>("derived")

        host.define({
            node: "derived",
            get: get => {
                get("good")
                try {
                    host.raiseControl(mismatch)
                } catch {}
                return 2
            },
        })
        const failed = host.read("derived")

        expect(errorOf(failed)).toBe(mismatch)
        expect(failed.token).not.toBe(previous.token)
        expect(host.records.get("derived")?.lastSuccess?.value).toBe(1)
        expect(
            host.records.get("derived")?.dependencies.map(({ node }) => node),
        ).toEqual(["good"])
    })

    test("a current same-domain control child remains a valid parent dependency", () => {
        const mismatch = Object.freeze({
            code: "VALDRES_RUNTIME_MISMATCH",
        })
        const host = new TestHost("persistent-post")
        host.setLeaf("good", 1)
        host.define({
            node: "child",
            get: get => {
                get("good")
                try {
                    host.raiseControl(mismatch)
                } catch {}
                return 2
            },
        })
        host.define({ node: "parent", get: get => get("child") })

        expect(errorOf(host.read("parent"))).toBe(mismatch)
        expect(
            host.records.get("child")?.dependencies.map(({ node }) => node),
        ).toEqual(["good"])
        expect(
            host.records.get("parent")?.dependencies.map(({ node }) => node),
        ).toEqual(["child"])
    })

    test("a completed child survives a pre-apply parent control rejection", () => {
        const mismatch = Object.freeze({ code: "VALDRES_RUNTIME_MISMATCH" })
        const host = new TestHost("persistent-pre")
        host.setLeaf("leaf", 2)
        host.define({ node: "child", get: get => get<number>("leaf") * 2 })
        host.define({
            node: "parent",
            get: get => {
                get("child")
                try {
                    host.raiseControl(mismatch)
                } catch {}
                return 5
            },
        })

        let thrown: unknown
        try {
            host.read("parent")
        } catch (error) {
            thrown = error
        }
        expect(thrown).toBe(mismatch)
        expect(host.records.has("parent")).toBe(false)
        expect(valueOf(host.read<number>("child"))).toBe(4)
        expect(host.evaluations.get("child")).toBe(1)
    })

    test("the first exact control fault wins over later throws and returns", () => {
        const first = Object.freeze({ code: "FIRST" })
        const second = Object.freeze({ code: "SECOND" })
        const host = new TestHost("persistent-post")
        host.define({
            node: "derived",
            get: () => {
                try {
                    host.raiseControl(first)
                } catch {}
                try {
                    host.raiseControl(second)
                } catch {}
                throw new Error("ordinary")
            },
        })

        expect(errorOf(host.read("derived"))).toBe(first)
    })

    test("a caught control fault prevents every later supplied read", () => {
        const first = Object.freeze({ code: "FIRST" })
        const host = new TestHost("persistent-post")
        host.setControlLeaf("foreign", first)
        host.setLeaf("after", 1)
        host.define({
            node: "derived",
            get: get => {
                try {
                    get("foreign")
                } catch {}
                try {
                    get("after")
                } catch {}
                return 2
            },
        })

        expect(errorOf(host.read("derived"))).toBe(first)
        expect(host.leafReads.get("foreign")).toBe(1)
        expect(host.leafReads.get("after")).toBeUndefined()
        expect(host.records.get("derived")?.dependencies).toEqual([])
    })

    test("pre-apply, scratch, and hydration hosts publish no control proposal", () => {
        for (const mode of [
            "persistent-pre",
            "scratch",
            "hydration",
        ] as const) {
            const mismatch = Object.freeze({ code: `MISMATCH_${mode}` })
            const host = new TestHost(mode)
            host.define({
                node: "derived",
                get: () => {
                    try {
                        host.raiseControl(mismatch)
                    } catch {}
                    return 1
                },
            })

            let thrown: unknown
            try {
                host.read("derived")
            } catch (error) {
                thrown = error
            }
            expect(thrown).toBe(mismatch)
            expect(host.records.has("derived")).toBe(false)
            expect(host.publications).toEqual([])
        }
    })

    test("ordinary caught capability failures may recover without doing work", () => {
        const host = new TestHost()
        const capability = Object.freeze({ code: "CAPABILITY_REJECTED" })
        host.define({
            node: "derived",
            get: () => {
                try {
                    throw capability
                } catch {
                    return 3
                }
            },
        })

        expect(valueOf(host.read<number>("derived"))).toBe(3)
    })

    test("V1M-SEL-005 returned and thrown thenables attach once and become named errors", async () => {
        const host = new TestHost()
        let thenGets = 0
        let thenCalls = 0
        let actualShadowedCalls = 0
        let shadowCallPropertyCalls = 0
        const thrownThenable = {
            get then() {
                thenGets++
                return (
                    _resolve: unknown,
                    reject: (error: unknown) => void,
                ) => {
                    thenCalls++
                    reject(new Error("contained"))
                }
            },
        }
        const backing = Promise.reject(new Error("contained shadowed call"))
        const shadowedThen = (
            onFulfilled: ((value: unknown) => unknown) | undefined,
            onRejected: (error: unknown) => unknown,
        ) => {
            actualShadowedCalls++
            return backing.then(onFulfilled, onRejected)
        }
        shadowedThen.call = () => {
            shadowCallPropertyCalls++
        }
        host.define({
            node: "returned",
            get: () => Promise.reject(new Error("contained native rejection")),
        })
        host.define({
            node: "thrown",
            get: () => {
                throw thrownThenable
            },
        })
        host.define({
            node: "shadowed-call",
            get: () => ({ then: shadowedThen }),
        })

        expect(errorOf(host.read("returned"))).toBeInstanceOf(
            InvalidSynchronousSelectorResultError,
        )
        expect(errorOf(host.read("thrown"))).toBeInstanceOf(
            InvalidSynchronousSelectorResultError,
        )
        expect(errorOf(host.read("shadowed-call"))).toBeInstanceOf(
            InvalidSynchronousSelectorResultError,
        )
        await Promise.resolve()
        expect(thenGets).toBe(1)
        expect(thenCalls).toBe(1)
        expect(actualShadowedCalls).toBe(1)
        expect(shadowCallPropertyCalls).toBe(0)
    })

    test("control and cycle precedence still contain rejected thenable returns", async () => {
        const unhandled: unknown[] = []
        const onUnhandled = (reason: unknown): void => {
            unhandled.push(reason)
        }
        process.on("unhandledRejection", onUnhandled)

        try {
            const control = Object.freeze({ code: "CONTROL" })
            const host = new TestHost("persistent-post")
            host.define({
                node: "controlled",
                get: () => {
                    try {
                        host.raiseControl(control)
                    } catch {}
                    return Promise.reject(new Error("contained control return"))
                },
            })
            host.define({
                node: "cyclic",
                get: get => {
                    try {
                        get("cyclic")
                    } catch {}
                    return Promise.reject(new Error("contained cycle return"))
                },
            })

            expect(errorOf(host.read("controlled"))).toBe(control)
            expect(errorOf(host.read("cyclic"))).toBeInstanceOf(
                SelectorCircularDependencyError,
            )

            host.setLeaf("leaf", 1)
            let comparatorControl = false
            host.define({
                node: "compared",
                get: get => get("leaf"),
                equal: (() => {
                    if (!comparatorControl) return false
                    try {
                        host.raiseControl(control)
                    } catch {}
                    return Promise.reject(
                        new Error("contained comparator control return"),
                    )
                }) as (previous: unknown, next: unknown) => boolean,
            })
            host.read("compared")
            comparatorControl = true
            host.markDirty("compared")
            expect(errorOf(host.read("compared"))).toBe(control)

            await Bun.sleep(0)
            expect(unhandled).toEqual([])
        } finally {
            process.off("unhandledRejection", onUnhandled)
        }
    })

    test("comparator thenables and non-booleans are never tested for truthiness", () => {
        const host = new TestHost()
        host.setLeaf("leaf", 1)
        let mode: "true" | "thenable" | "object" | "throw" = "true"
        host.define({
            node: "derived",
            get: get => get("leaf"),
            equal: (() => {
                if (mode === "thenable") return Promise.resolve(true)
                if (mode === "object") return { truthy: true }
                if (mode === "throw") throw new Error("compare")
                return true
            }) as (previous: unknown, next: unknown) => boolean,
        })
        host.read("derived")

        mode = "thenable"
        host.markDirty("derived")
        expect(errorOf(host.read("derived"))).toBeInstanceOf(
            InvalidSynchronousSelectorResultError,
        )
        mode = "object"
        host.markDirty("derived")
        expect(errorOf(host.read("derived"))).toBeInstanceOf(
            InvalidSelectorComparatorResultError,
        )
        mode = "throw"
        host.markDirty("derived")
        expect(errorOf(host.read("derived"))).toBeInstanceOf(
            SelectorComparatorError,
        )
    })

    test("the supplied get is revoked immediately after synchronous return", async () => {
        const host = new TestHost()
        host.setLeaf("leaf", 1)
        let lateGet: (() => unknown) | undefined
        host.define({
            node: "derived",
            get: get => {
                lateGet = () => get("leaf")
                return 1
            },
        })
        host.read("derived")
        const reads = host.leafReads.get("leaf") ?? 0

        expect(lateGet).toBeDefined()
        expect(() => lateGet!()).toThrow(SelectorReadRevokedError)
        await Promise.resolve()
        expect(() => lateGet!()).toThrow(SelectorReadRevokedError)
        expect(host.leafReads.get("leaf") ?? 0).toBe(reads)
    })
})

describe("v1 selector evaluator host modes", () => {
    test("V1M-SEL-006 scratch hosts memoize per generation without mutating committed records", () => {
        const committed = new TestHost()
        committed.setLeaf("leaf", 2)
        committed.define({ node: "derived", get: get => get("leaf") })
        committed.read("derived")
        const committedRecord = committed.records.get("derived")!

        const scratch = new TestHost("scratch", {
            liveRecords: committed.records,
            comparisonRecords: committed.records,
        })
        scratch.leaves.set("leaf", committed.leaves.get("leaf")!)
        scratch.define({ node: "derived", get: get => get("leaf") })
        const first = scratch.read("derived")
        const second = scratch.read("derived")

        expect(second).toBe(first)
        expect(scratch.evaluations.get("derived")).toBe(1)
        expect(committed.records.get("derived")).toBe(committedRecord)

        const nextGeneration = new TestHost("scratch", {
            liveRecords: committed.records,
            comparisonRecords: committed.records,
        })
        nextGeneration.leaves.set("leaf", committed.leaves.get("leaf")!)
        nextGeneration.define({ node: "derived", get: get => get("leaf") })
        nextGeneration.read("derived")
        expect(nextGeneration.evaluations.get("derived")).toBe(1)
    })

    test("V1M-SEL-007 hydration substitutes server leaves, ignores live baselines, and is disposable", () => {
        const live = new TestHost()
        live.setLeaf("browser", "live")
        live.define({ node: "derived", get: get => get("browser") })
        live.read("derived")
        const liveRecord = live.records.get("derived")!
        let comparatorCalls = 0

        const hydration = new TestHost("hydration", {
            liveRecords: live.records,
            comparisonRecords: live.records,
        })
        hydration.setLeaf("browser", "server")
        hydration.define({
            node: "derived",
            get: get => get("browser"),
            equal: () => {
                comparatorCalls++
                return true
            },
        })

        const first = hydration.read<string>("derived")
        const second = hydration.read<string>("derived")
        expect(valueOf(first)).toBe("server")
        expect(second).toBe(first)
        expect(comparatorCalls).toBe(0)
        expect(hydration.leafReads.get("browser")).toBe(1)
        expect(live.records.get("derived")).toBe(liveRecord)

        hydration.dispose()
        expect(hydration.records.size).toBe(0)
        expect(() => hydration.read("derived")).toThrow("host disposed")
    })

    test("a missing hydration reader is sticky even when selector code catches it", () => {
        const hydration = new TestHost("hydration")
        hydration.define({
            node: "derived",
            get: get => {
                try {
                    get("missing")
                } catch {}
                return "fallback"
            },
        })

        expect(() => hydration.read("derived")).toThrow(
            expect.objectContaining({ code: "MISSING_SERVER_READER" }),
        )
        expect(hydration.records.has("derived")).toBe(false)
    })
})

describe("v1 selector evaluator differential oracle", () => {
    test("V1M-SEL-008 matches the independent oracle across deterministic dynamic traces", () => {
        for (let seed = 1; seed <= 64; seed++) {
            let randomState = seed
            const random = (): number => {
                randomState ^= randomState << 13
                randomState ^= randomState >>> 17
                randomState ^= randomState << 5
                return randomState >>> 0
            }

            const host = new TestHost()
            host.setLeaf("gate", false)
            host.setLeaf("prefix", 0)
            host.setLeaf("left", 0)
            host.setLeaf("right", 0)
            host.define({
                node: "choice",
                get: get => {
                    const gate = get<boolean>("gate")
                    get("prefix")
                    const selected = get<number>(gate ? "left" : "right")
                    get("prefix")
                    return selected
                },
            })

            const oracle = createSelectorOracle([
                {
                    kind: "leaf",
                    id: "gate",
                    state: { kind: "value", value: value.boolean(false) },
                },
                {
                    kind: "leaf",
                    id: "prefix",
                    state: { kind: "value", value: value.number(0) },
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
                        const gate = get("gate")
                        if (gate.kind !== "boolean") {
                            throw new Error("invalid symbolic gate")
                        }
                        get("prefix")
                        const selected = get(gate.value ? "left" : "right")
                        get("prefix")
                        return selected
                    },
                },
            ])

            for (let step = 0; step < 32; step++) {
                const gate = (random() & 1) === 1
                const left = random() % 100
                const right = random() % 100
                const selected = gate ? "left" : "right"
                const fails = random() % 7 === 0

                host.setLeaf("gate", gate)
                host.setLeaf("prefix", step)
                host.setLeaf("left", left)
                host.setLeaf("right", right)
                oracle.setLeafValue("gate", value.boolean(gate))
                oracle.setLeafValue("prefix", value.number(step))
                oracle.setLeafValue("left", value.number(left))
                oracle.setLeafValue("right", value.number(right))
                if (fails) {
                    host.setLeafError(selected, Object.freeze({ code: "FAIL" }))
                    oracle.setLeafError(selected, "FAIL")
                }

                const candidate = host.read<number>("choice")
                const expected = oracle.evaluate("choice")
                expect(
                    host.records
                        .get("choice")
                        ?.dependencies.map(dependency => dependency.node),
                ).toEqual([...expected.dependencies])
                expect(candidate.outcome.kind).toBe(expected.outcome.kind)
                if (
                    candidate.outcome.kind === "value" &&
                    expected.outcome.kind === "value"
                ) {
                    if (expected.outcome.value.kind !== "number") {
                        throw new Error("expected a numeric oracle outcome")
                    }
                    expect(candidate.outcome.value).toBe(
                        expected.outcome.value.value,
                    )
                }
            }
        }
    })
})
