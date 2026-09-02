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
import {
    createInspectionRecorder,
    type CycleSearchInspectionDetail,
} from "../../src/v1-internal/inspection"
import type {
    SelectorComparisonBaseline,
    SelectorDefinition,
    SelectorEvaluationHost,
    SelectorEvaluationProposal,
    SelectorNegativePathMemo,
    SelectorRecordView,
    SelectorCycleSearch,
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
    readonly serveEffects = new Map<
        Node,
        (session: SelectorEvaluationSession<Node>) => void
    >()
    readonly publications: SelectorEvaluationProposal<Node, Token>[] = []
    graphVersionReads = 0
    selectorRecordReads = 0
    readonly selectorRecordReadNodes: Node[] = []
    readonly selectorDependencyNodeReadNodes: Node[] = []
    readonly liveRecords: Map<Node, TestRecord> | undefined
    readonly comparisonRecords: Map<Node, TestRecord> | undefined
    readonly getSelectorDependencyNodes?: (
        node: Node,
    ) => readonly Node[] | undefined
    cycleTrace: SelectorCycleSearch<Node, Token> | undefined
    #nextToken = 1
    #selectorGraphVersion = 0
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
        if (mode === "persistent-pre" || mode === "persistent-post") {
            this.getSelectorDependencyNodes = node => {
                this.selectorDependencyNodeReadNodes.push(node)
                const record = this.records.get(node)
                if (record === undefined) return undefined
                return Object.freeze(
                    record.dependencies
                        .filter(dependency =>
                            this.definitions.has(dependency.node),
                        )
                        .map(dependency => dependency.node),
                )
            }
        }
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

    setServeEffect(
        node: Node,
        effect: (session: SelectorEvaluationSession<Node>) => void,
    ): void {
        this.serveEffects.set(node, effect)
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
        this.serveEffects.get(node)?.(session)
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
            proposal = evaluateSelector(
                definition,
                this,
                session,
                this.cycleTrace,
            )
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
        this.#selectorGraphVersion++
        session.noteSelectorGraphPublication(this)
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
        this.selectorRecordReads++
        this.selectorRecordReadNodes.push(node)
        const record = this.records.get(node)
        if (record === undefined && this.definitions.has(node)) {
            for (const candidate of this.records.values()) {
                if (
                    candidate.dependencies.some(dependency =>
                        Object.is(dependency.node, node),
                    )
                ) {
                    throw new Error(
                        "TestHost selector-record absence is not graph-closed",
                    )
                }
            }
        }
        if (record === undefined) return undefined
        return Object.freeze({ dependencies: record.dependencies })
    }

    getSelectorGraphVersion(): number {
        this.graphVersionReads++
        return this.#selectorGraphVersion
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

    activeDependencyPrefix(
        selector: Node,
    ): readonly Readonly<{ node: Node }>[] {
        const prefix = this.#activeSession?.getTransientDependencies(
            this,
            selector,
        )
        if (prefix === undefined) {
            throw new Error("no active selector dependency prefix")
        }
        return prefix
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

const normalizeCycleParityError = (error: unknown): unknown => {
    if (error instanceof SelectorCircularDependencyError) {
        return Object.freeze({
            name: error.name,
            selector: error.selector,
            path: error.path,
        })
    }
    if (error instanceof SelectorGetterError) {
        return Object.freeze({
            name: error.name,
            selector: error.selector,
            cause: normalizeCycleParityError(error.cause),
        })
    }
    if (error instanceof SelectorDependencyError) {
        return Object.freeze({
            name: error.name,
            dependency: error.dependency,
            cause: normalizeCycleParityError(error.cause),
        })
    }
    if (error instanceof Error) {
        return Object.freeze({ name: error.name, message: error.message })
    }
    return error
}

const normalizeCycleParityOutcome = (
    served: ServedSelectorOutcome<Token>,
): unknown =>
    served.outcome.kind === "value"
        ? Object.freeze({ kind: "value", value: served.outcome.value })
        : Object.freeze({
              kind: served.outcome.kind,
              error: normalizeCycleParityError(served.outcome.error),
          })

const cycleParitySnapshot = (
    host: TestHost,
    served: ServedSelectorOutcome<Token>,
): unknown =>
    Object.freeze({
        served: normalizeCycleParityOutcome(served),
        records: [...host.records.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([node, record]) =>
                Object.freeze({
                    node,
                    dependencies: record.dependencies.map(
                        dependency => dependency.node,
                    ),
                    served: normalizeCycleParityOutcome(record.served),
                }),
            ),
    })

interface CycleParityCase {
    readonly name: string
    readonly mode: HostMode
    readonly hostKind: "committed" | "scratch" | "hydration"
    readonly prepare: (host: TestHost) => void
    readonly mutate: (host: TestHost) => ServedSelectorOutcome<Token>
    readonly verify: (searches: readonly CycleSearchInspectionDetail[]) => void
}

const runCycleParityCase = (scenario: CycleParityCase): void => {
    const run = (
        measured: boolean,
    ): Readonly<{
        snapshot: unknown
        searches: readonly CycleSearchInspectionDetail[]
    }> => {
        const host = new TestHost(scenario.mode)
        scenario.prepare(host)
        const setup = measured ? createInspectionRecorder() : undefined
        if (setup !== undefined) {
            const hostRef = setup.recorder.reference(
                host,
                scenario.hostKind === "committed" ? "scope" : "scratch-host",
            )
            host.cycleTrace = (
                start,
                target,
                cycleHost,
                session,
                site,
                negativeMemo,
            ) =>
                setup.recorder.findDependencyPath(
                    scenario.hostKind,
                    hostRef,
                    start,
                    target,
                    cycleHost,
                    session,
                    site,
                    cycleHost.getSelectorGraphVersion(),
                    session.getSelectorGraphPublicationCount(cycleHost),
                    false,
                    negativeMemo,
                )
        }
        const served = scenario.mutate(host)
        const searches =
            setup?.inspect
                .export()
                .details.filter(
                    (detail): detail is CycleSearchInspectionDetail =>
                        detail.type === "cycle-search",
                ) ?? []
        return Object.freeze({
            snapshot: cycleParitySnapshot(host, served),
            searches,
        })
    }

    const fast = run(false)
    const measured = run(true)
    expect(measured.snapshot).toEqual(fast.snapshot)
    scenario.verify(measured.searches)
}

const findExpectedDependencyPath = (
    adjacency: ReadonlyMap<Node, readonly Node[]>,
    start: Node,
    target: Node,
): Readonly<{ path: readonly Node[] | undefined; visits: number }> => {
    const root = Symbol("dependency-path-root")
    const pending = [start]
    const parent = new Map<Node, Node | typeof root>([[start, root]])
    let visits = 0

    while (pending.length > 0) {
        const node = pending.pop() as Node
        visits++
        if (Object.is(node, target)) {
            const reversed: Node[] = []
            let cursor: Node | typeof root = node
            while (cursor !== root) {
                reversed.push(cursor)
                cursor = parent.get(cursor) as Node | typeof root
            }
            reversed.reverse()
            return Object.freeze({ path: Object.freeze(reversed), visits })
        }
        for (const dependency of adjacency.get(node) ?? []) {
            if (parent.has(dependency)) continue
            parent.set(dependency, node)
            pending.push(dependency)
        }
    }

    return Object.freeze({ path: undefined, visits })
}

const createRandomDagCase = (
    seed: number,
    shouldFind: boolean,
): Readonly<{
    adjacency: ReadonlyMap<Node, readonly Node[]>
    start: Node
    target: Node
    expected: Readonly<{ path: readonly Node[] | undefined; visits: number }>
}> => {
    let state = seed >>> 0
    const random = (): number => {
        state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
        return state / 0x1_0000_0000
    }
    const nodes = Array.from({ length: 24 }, (_, index) => `random-${index}`)
    const adjacency = new Map<Node, readonly Node[]>()
    adjacency.set(nodes[0]!, Object.freeze([]))
    for (let index = 1; index < nodes.length; index++) {
        const count = Math.min(index, 1 + Math.floor(random() * 3))
        const dependencies: Node[] = []
        while (dependencies.length < count) {
            const dependency = nodes[Math.floor(random() * index)]!
            if (!dependencies.includes(dependency))
                dependencies.push(dependency)
        }
        adjacency.set(nodes[index]!, Object.freeze(dependencies))
    }

    for (let startIndex = nodes.length - 1; startIndex > 0; startIndex--) {
        for (let targetIndex = 0; targetIndex < startIndex; targetIndex++) {
            const start = nodes[startIndex]!
            const target = nodes[targetIndex]!
            const expected = findExpectedDependencyPath(
                adjacency,
                start,
                target,
            )
            if ((expected.path !== undefined) === shouldFind) {
                return Object.freeze({ adjacency, start, target, expected })
            }
        }
    }

    throw new Error(`seed ${seed} did not produce the requested graph case`)
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

    test("shares the proposal dependency prefix with the active transient frame", () => {
        const host = new TestHost()
        host.setLeaf("a", 2)
        host.setLeaf("b", 3)
        let activePrefix: readonly Readonly<{ node: Node }>[] | undefined
        let activeSession: SelectorEvaluationSession<Node> | undefined
        const observedLengths: number[] = []
        host.setServeEffect("b", session => {
            activeSession = session
            const servedPrefix = session.getTransientDependencies(host, "sum")
            expect(Object.is(servedPrefix, activePrefix)).toBe(true)
            expect(servedPrefix?.map(({ node }) => node)).toEqual(["a"])
        })
        host.define({
            node: "sum",
            get: get => {
                const a = get<number>("a")
                activePrefix = host.activeDependencyPrefix("sum")
                observedLengths.push(activePrefix.length)
                const b = get<number>("b")
                observedLengths.push(activePrefix.length)
                return a + b
            },
        })

        expect(valueOf(host.read<number>("sum"))).toBe(5)
        const installed = host.records.get("sum")?.dependencies

        expect(observedLengths).toEqual([1, 2])
        expect(Object.is(activePrefix, installed)).toBe(true)
        expect(activePrefix?.map(({ node }) => node)).toEqual(["a", "b"])
        expect(Object.isFrozen(activePrefix)).toBe(true)
        expect(
            activeSession?.getTransientDependencies(host, "sum") === undefined,
        ).toBe(true)
    })

    test("deduplicates a dependency accepted by a reentrant serve callback", () => {
        const host = new TestHost()
        host.setLeaf("lazy", 7)
        let suppliedGet: (<Value>(node: Node) => Value) | undefined
        let reenter = true
        host.setServeEffect("lazy", () => {
            if (!reenter) return
            reenter = false
            suppliedGet?.<number>("lazy")
        })
        host.define({
            node: "parent",
            get: get => {
                suppliedGet = get
                return get<number>("lazy")
            },
        })

        expect(valueOf(host.read<number>("parent"))).toBe(7)
        expect(
            host.records.get("parent")?.dependencies.map(({ node }) => node),
        ).toEqual(["lazy"])
    })

    test("does not confuse a different reentrant dependency with the suspended read", () => {
        const host = new TestHost()
        host.setLeaf("stable", 7)
        host.setLeaf("nested", 11)
        let suppliedGet: (<Value>(node: Node) => Value) | undefined
        let reenter = false
        host.define({
            node: "parent",
            get: get => {
                suppliedGet = get
                return get<number>("stable")
            },
        })
        expect(valueOf(host.read<number>("parent"))).toBe(7)

        host.setServeEffect("stable", () => {
            if (!reenter) return
            reenter = false
            suppliedGet?.<number>("nested")
        })
        reenter = true
        host.markDirty("parent")

        expect(valueOf(host.read<number>("parent"))).toBe(7)
        expect(
            host.records.get("parent")?.dependencies.map(({ node }) => node),
        ).toEqual(["nested", "stable"])
    })

    test("reuses immutable dependency snapshots when node and token stay current", () => {
        const host = new TestHost()
        host.setLeaf("a", 2)
        host.setLeaf("b", 3)
        host.setLeaf("c", 4)
        let useB = true
        host.define({
            node: "sum",
            get: get => get<number>("a") + get<number>(useB ? "b" : "c"),
        })

        expect(valueOf(host.read<number>("sum"))).toBe(5)
        const previous = host.records.get("sum")!.dependencies
        host.markDirty("sum")
        expect(valueOf(host.read<number>("sum"))).toBe(5)
        const next = host.records.get("sum")!.dependencies

        expect(next).not.toBe(previous)
        expect(next[0]).toBe(previous[0])
        expect(next[1]).toBe(previous[1])

        useB = false
        host.markDirty("sum")
        expect(valueOf(host.read<number>("sum"))).toBe(6)
        const changedNode = host.records.get("sum")!.dependencies
        expect(changedNode[0]).toBe(next[0])
        expect(changedNode[1]).not.toBe(next[1])
        expect(changedNode[1]!.node).toBe("c")

        host.setLeaf("a", 4)
        expect(valueOf(host.read<number>("sum"))).toBe(8)
        const changedToken = host.records.get("sum")!.dependencies
        expect(changedToken[0]).not.toBe(changedNode[0])
        expect(changedToken[1]).toBe(changedNode[1])
    })

    test("preserves generic node identity across stable replay and Set fallback", () => {
        const evaluateIdentityCase = (
            initial: Node,
            next: Node,
            repeat: Node,
        ) => {
            const host = new TestHost()
            host.setLeaf(initial, 1)
            let primary = initial
            let duplicate = initial
            host.define({
                node: "parent",
                get: get => {
                    const result = get<number>(primary)
                    get(duplicate)
                    return result
                },
            })

            expect(valueOf(host.read<number>("parent"))).toBe(1)
            const previous = host.records.get("parent")!.dependencies
            primary = next
            duplicate = repeat
            host.markDirty("parent")
            expect(valueOf(host.read<number>("parent"))).toBe(1)
            const current = host.records.get("parent")!.dependencies

            expect(previous).toHaveLength(1)
            expect(current).toHaveLength(1)
            return { current, previous }
        }

        const undefinedNode = undefined as unknown as Node
        const undefinedReplay = evaluateIdentityCase(
            undefinedNode,
            undefinedNode,
            undefinedNode,
        )
        expect(undefinedReplay.current[0]).toBe(undefinedReplay.previous[0])
        expect(undefinedReplay.current[0]!.node).toBeUndefined()

        const nanNode = NaN as unknown as Node
        const nanReplay = evaluateIdentityCase(nanNode, nanNode, nanNode)
        expect(nanReplay.current[0]).toBe(nanReplay.previous[0])
        expect(Object.is(nanReplay.current[0]!.node, NaN)).toBe(true)

        const negativeZero = -0 as unknown as Node
        const positiveZero = +0 as unknown as Node
        const zeroFallback = evaluateIdentityCase(
            negativeZero,
            positiveZero,
            negativeZero,
        )
        expect(Object.is(zeroFallback.previous[0]!.node, -0)).toBe(true)
        expect(Object.is(zeroFallback.current[0]!.node, +0)).toBe(true)
        expect(zeroFallback.current[0]).not.toBe(zeroFallback.previous[0])
    })

    test("reuses the graph observation validated immediately after serve", () => {
        const host = new TestHost()
        host.setLeaf("leaf", 1)
        host.define({ node: "derived", get: get => get<number>("leaf") })

        expect(valueOf(host.read<number>("derived"))).toBe(1)
        expect(host.graphVersionReads).toBe(3)
    })

    test("does not request selector-only adjacency during an ordinary warm evaluation", () => {
        const host = new TestHost()
        host.setLeaf("leaf", 1)
        host.define({ node: "derived", get: get => get<number>("leaf") })
        expect(valueOf(host.read<number>("derived"))).toBe(1)
        host.selectorDependencyNodeReadNodes.length = 0

        host.setLeaf("leaf", 2)

        expect(valueOf(host.read<number>("derived"))).toBe(2)
        expect(host.selectorDependencyNodeReadNodes).toEqual([])
    })

    test("falls back to old-topology membership when dependencies reorder", () => {
        const host = new TestHost()
        host.setLeaf("a", 1)
        host.setLeaf("b", 2)
        let reversed = false
        host.define({
            node: "ordered",
            get: get => {
                if (reversed) {
                    get("b")
                    get("a")
                } else {
                    get("a")
                    get("b")
                }
                return 1
            },
        })

        expect(valueOf(host.read<number>("ordered"))).toBe(1)
        reversed = true
        host.markDirty("ordered")
        const recordReadsBefore = host.selectorRecordReads
        expect(valueOf(host.read<number>("ordered"))).toBe(1)
        expect(host.selectorRecordReads - recordReadsBefore).toBe(1)
        expect(
            host.records
                .get("ordered")!
                .dependencies.map(dependency => dependency.node),
        ).toEqual(["b", "a"])
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
    const parityCases: readonly CycleParityCase[] = [
        {
            name: "committed positive new edge preserves exact DFS order",
            mode: "persistent-pre",
            hostKind: "committed",
            prepare(host) {
                for (const leaf of [
                    "noise-before",
                    "noise-between",
                    "noise-after",
                ]) {
                    host.setLeaf(leaf, 1)
                }
                host.define({ node: "parent", get: () => 1 })
                host.define({ node: "left", get: get => get("parent") })
                host.define({ node: "right", get: get => get("parent") })
                host.define({
                    node: "start",
                    get: get => {
                        get("noise-before")
                        get("left")
                        get("noise-between")
                        get("right")
                        get("noise-after")
                        return 1
                    },
                })
                expect(valueOf(host.read<number>("parent"))).toBe(1)
                expect(valueOf(host.read<number>("start"))).toBe(1)
            },
            mutate(host) {
                host.define({ node: "parent", get: get => get("start") })
                return host.read("parent")
            },
            verify(searches) {
                expect(searches).toHaveLength(1)
                expect(searches[0]).toMatchObject({
                    host: "committed",
                    site: "new-edge-proof",
                    start: "start",
                    target: "parent",
                    found: true,
                    path: ["start", "right", "parent"],
                    visits: 3,
                    edges: 3,
                    recordExpansions: 2,
                    terminalPrunes: 0,
                })
            },
        },
        {
            name: "committed negative proofs prune terminal leaf noise",
            mode: "persistent-pre",
            hostKind: "committed",
            prepare(host) {
                const leaves = Array.from(
                    { length: 32 },
                    (_, index) => `leaf-${index}`,
                )
                for (const leaf of leaves) host.setLeaf(leaf, 1)
                host.define({
                    node: "start",
                    get: get => {
                        for (const leaf of leaves) get(leaf)
                        return 1
                    },
                })
                host.define({ node: "parent", get: () => 1 })
                expect(valueOf(host.read<number>("start"))).toBe(1)
                expect(valueOf(host.read<number>("parent"))).toBe(1)
            },
            mutate(host) {
                host.define({
                    node: "parent",
                    get: get => {
                        get("leaf-0")
                        return get("start")
                    },
                })
                return host.read("parent")
            },
            verify(searches) {
                expect(
                    searches.map(search => ({
                        start: search.start,
                        found: search.found,
                        visits: search.visits,
                        recordExpansions: search.recordExpansions,
                        terminalPrunes: search.terminalPrunes,
                    })),
                ).toEqual([
                    {
                        start: "leaf-0",
                        found: false,
                        visits: 1,
                        recordExpansions: 0,
                        terminalPrunes: 1,
                    },
                    {
                        start: "start",
                        found: false,
                        visits: 1,
                        recordExpansions: 1,
                        terminalPrunes: 0,
                    },
                ])
            },
        },
        {
            name: "fresh publication revalidates an accepted prefix",
            mode: "persistent-pre",
            hostKind: "committed",
            prepare(host) {
                host.define({ node: "parent", get: () => 1 })
                host.define({ node: "changed", get: () => 1 })
                host.define({
                    node: "new-edge",
                    get: get => get("changed"),
                })
                host.define({ node: "cached", get: get => get("parent") })
                host.define({ node: "later", get: () => 1 })
                expect(valueOf(host.read<number>("new-edge"))).toBe(1)
                expect(valueOf(host.read<number>("cached"))).toBe(1)
                expect(valueOf(host.read<number>("later"))).toBe(1)
            },
            mutate(host) {
                host.define({
                    node: "parent",
                    get: get => {
                        get("new-edge")
                        get("later")
                        return 1
                    },
                })
                host.define({
                    node: "later",
                    get: () => {
                        host.define({
                            node: "changed",
                            get: get => get("cached"),
                        })
                        expect(valueOf(host.read<number>("changed"))).toBe(1)
                        return 1
                    },
                })
                return host.read("parent")
            },
            verify(searches) {
                expect(
                    searches.some(
                        search =>
                            search.site === "new-edge-proof" && !search.found,
                    ),
                ).toBe(true)
                expect(searches.find(search => search.found)).toMatchObject({
                    host: "committed",
                    site: "prefix-revalidation",
                    start: "new-edge",
                    target: "parent",
                    found: true,
                    path: ["new-edge", "changed", "cached", "parent"],
                })
            },
        },
        {
            name: "same-session proof expands a transient parent prefix",
            mode: "persistent-pre",
            hostKind: "committed",
            prepare(host) {
                host.define({ node: "parent", get: () => 1 })
                host.define({ node: "changed", get: () => 1 })
                host.define({
                    node: "new-edge",
                    get: get => get("changed"),
                })
                host.define({ node: "cached", get: get => get("parent") })
                host.define({ node: "later", get: () => 1 })
                expect(valueOf(host.read<number>("new-edge"))).toBe(1)
                expect(valueOf(host.read<number>("cached"))).toBe(1)
                expect(valueOf(host.read<number>("later"))).toBe(1)
            },
            mutate(host) {
                host.define({
                    node: "parent",
                    get: get => {
                        get("new-edge")
                        get("later")
                        return 1
                    },
                })
                host.define({ node: "changed", get: get => get("cached") })
                host.setServeEffect("later", session => {
                    host.serve("changed", session)
                })
                return host.read("parent")
            },
            verify(searches) {
                expect(searches.find(search => search.found)).toMatchObject({
                    host: "committed",
                    site: "new-edge-proof",
                    start: "cached",
                    target: "changed",
                    found: true,
                    path: ["cached", "parent", "new-edge", "changed"],
                    visits: 4,
                    transientExpansions: 1,
                    recordExpansions: 2,
                })
            },
        },
        {
            name: "scratch host falls back to full selector records",
            mode: "scratch",
            hostKind: "scratch",
            prepare(host) {
                host.setLeaf("noise", 1)
                host.define({ node: "parent", get: () => 1 })
                host.define({ node: "right", get: get => get("parent") })
                host.define({
                    node: "start",
                    get: get => {
                        get("right")
                        get("noise")
                        return 1
                    },
                })
                expect(valueOf(host.read<number>("parent"))).toBe(1)
                expect(valueOf(host.read<number>("start"))).toBe(1)
            },
            mutate(host) {
                host.define({ node: "parent", get: get => get("start") })
                return host.read("parent")
            },
            verify(searches) {
                expect(searches).toHaveLength(1)
                expect(searches[0]).toMatchObject({
                    host: "scratch",
                    site: "new-edge-proof",
                    start: "start",
                    target: "parent",
                    found: true,
                    path: ["start", "right", "parent"],
                    visits: 4,
                    edges: 3,
                    recordExpansions: 2,
                    terminalPrunes: 1,
                })
            },
        },
    ]

    for (const scenario of parityCases) {
        test(`fast and measured DFS agree: ${scenario.name}`, () => {
            runCycleParityCase(scenario)
        })
    }

    for (const seed of [0x5eed, 0xc0ffee]) {
        for (const shouldFind of [false, true]) {
            test(`fast and measured DFS agree on seeded DAG ${seed.toString(16)} (${shouldFind ? "positive" : "negative"})`, () => {
                const randomCase = createRandomDagCase(seed, shouldFind)
                runCycleParityCase({
                    name: `seeded DAG ${seed}`,
                    mode: "persistent-pre",
                    hostKind: "committed",
                    prepare(host) {
                        for (const [
                            node,
                            dependencies,
                        ] of randomCase.adjacency) {
                            host.define({
                                node,
                                get: get => {
                                    for (const dependency of dependencies) {
                                        get(dependency)
                                    }
                                    return 1
                                },
                            })
                        }
                        for (const node of randomCase.adjacency.keys()) {
                            expect(valueOf(host.read<number>(node))).toBe(1)
                        }
                    },
                    mutate(host) {
                        host.define({
                            node: randomCase.target,
                            get: get => get(randomCase.start),
                        })
                        return host.read(randomCase.target)
                    },
                    verify(searches) {
                        expect(searches).toHaveLength(1)
                        expect(searches[0]).toMatchObject({
                            host: "committed",
                            site: "new-edge-proof",
                            start: randomCase.start,
                            target: randomCase.target,
                            found: shouldFind,
                            visits: randomCase.expected.visits,
                        })
                        if (randomCase.expected.path === undefined) {
                            expect(searches[0]?.path).toBeUndefined()
                        } else {
                            expect(searches[0]?.path).toEqual(
                                randomCase.expected.path,
                            )
                        }
                    },
                })
            })
        }
    }

    test("traced search preserves the fast path outcome and records one aggregate per proof", () => {
        const host = new TestHost()
        const { recorder, inspect } = createInspectionRecorder()
        const hostRef = recorder.reference(host, "scope")
        host.cycleTrace = (
            start,
            target,
            cycleHost,
            session,
            site,
            negativeMemo,
        ) =>
            recorder.findDependencyPath(
                "committed",
                hostRef,
                start,
                target,
                cycleHost,
                session,
                site,
                cycleHost.getSelectorGraphVersion(),
                session.getSelectorGraphPublicationCount(cycleHost),
                false,
                negativeMemo,
            )
        const leaves = Array.from({ length: 32 }, (_, index) => `leaf-${index}`)
        for (const leaf of leaves) host.setLeaf(leaf, 1)
        host.define({ node: "parent", get: () => 1 })
        host.define({ node: "right", get: get => get("parent") })
        host.define({
            node: "start",
            get: get => {
                for (const leaf of leaves) get(leaf)
                get("right")
                return 1
            },
        })
        expect(valueOf(host.read<number>("parent"))).toBe(1)
        expect(valueOf(host.read<number>("start"))).toBe(1)

        host.define({ node: "parent", get: get => get("start") })
        const error = errorOf(host.read("parent"))

        expect(error).toBeInstanceOf(SelectorCircularDependencyError)
        expect((error as SelectorCircularDependencyError).path).toEqual([
            "parent",
            "start",
            "right",
            "parent",
        ])
        const measurements = inspect
            .export()
            .details.filter(detail => detail.type === "cycle-search")
        const found = measurements.filter(measurement => measurement.found)
        expect(found).toHaveLength(1)
        expect(found[0]).toMatchObject({
            site: "new-edge-proof",
            start: "start",
            target: "parent",
            path: ["start", "right", "parent"],
            visits: 3,
            recordExpansions: 2,
        })
        expect(
            measurements.every(
                measurement =>
                    typeof measurement.visits === "number" &&
                    measurement.visits > 0,
            ),
        ).toBe(true)
        expect(measurements.length).toBeLessThan(10)
    })

    test("selector-only adjacency excludes terminal leaf noise from a negative proof", () => {
        const host = new TestHost()
        const leaves = Array.from({ length: 32 }, (_, index) => `leaf-${index}`)
        for (const leaf of leaves) host.setLeaf(leaf, 1)
        host.define({
            node: "start",
            get: get => {
                for (const leaf of leaves) get(leaf)
                return 1
            },
        })
        host.define({ node: "parent", get: () => 1 })
        expect(valueOf(host.read<number>("start"))).toBe(1)
        expect(valueOf(host.read<number>("parent"))).toBe(1)

        host.define({
            node: "parent",
            get: get => {
                get(leaves[0]!)
                return get("start")
            },
        })
        host.selectorRecordReadNodes.length = 0
        host.selectorDependencyNodeReadNodes.length = 0

        expect(valueOf(host.read<number>("parent"))).toBe(1)
        expect(host.selectorRecordReadNodes).toEqual(["parent"])
        expect(host.selectorDependencyNodeReadNodes).toEqual([
            "leaf-0",
            "start",
        ])
    })

    test("selector-only adjacency preserves DFS order and the exact positive cycle path", () => {
        const host = new TestHost()
        host.setLeaf("noise-before", 1)
        host.setLeaf("noise-between", 1)
        host.setLeaf("noise-after", 1)
        host.define({ node: "parent", get: () => 1 })
        host.define({ node: "left", get: get => get("parent") })
        host.define({ node: "right", get: get => get("parent") })
        host.define({
            node: "start",
            get: get => {
                get("noise-before")
                get("left")
                get("noise-between")
                get("right")
                get("noise-after")
                return 1
            },
        })
        expect(valueOf(host.read<number>("parent"))).toBe(1)
        expect(valueOf(host.read<number>("start"))).toBe(1)

        host.define({ node: "parent", get: get => get("start") })
        host.selectorRecordReadNodes.length = 0
        host.selectorDependencyNodeReadNodes.length = 0
        const error = errorOf(host.read("parent"))

        expect(error).toBeInstanceOf(SelectorCircularDependencyError)
        expect((error as SelectorCircularDependencyError).path).toEqual([
            "parent",
            "start",
            "right",
            "parent",
        ])
        expect(host.selectorRecordReadNodes).toEqual(["parent"])
        expect(host.selectorDependencyNodeReadNodes).toEqual(["start", "right"])
    })

    test("keeps singleton prefix revalidation on the allocation-free search path", () => {
        const host = new TestHost()
        host.setLeaf("dependency", 1)
        host.setLeaf("trigger", 1)
        host.define({ node: "changed", get: () => 1 })
        expect(valueOf(host.read<number>("changed"))).toBe(1)
        const parent: SelectorDefinition<Node, number> = {
            node: "parent",
            get: get => {
                get("dependency")
                get("trigger")
                return 1
            },
        }
        host.define(parent)
        expect(valueOf(host.read<number>("parent"))).toBe(1)

        const prefixMemos: (SelectorNegativePathMemo<Node> | undefined)[] = []
        host.cycleTrace = (
            _start,
            _target,
            _cycleHost,
            _session,
            site,
            negativeMemo,
        ) => {
            if (site === 0) prefixMemos.push(negativeMemo)
            return undefined
        }
        host.define(parent)
        host.define({ node: "changed", get: () => 2 })
        let published = false
        host.setServeEffect("trigger", () => {
            if (published) return
            published = true
            expect(valueOf(host.read<number>("changed"))).toBe(2)
        })

        expect(valueOf(host.read<number>("parent"))).toBe(1)
        expect(prefixMemos).toEqual([undefined])
    })

    test("shares proven-negative selector reads across one prefix revalidation batch", () => {
        const host = new TestHost()
        const width = 256
        const depth = 512
        host.setLeaf("tail", 1)
        for (let index = depth - 1; index >= 0; index--) {
            const dependency =
                index + 1 === depth ? "tail" : `chain-${index + 1}`
            host.define({
                node: `chain-${index}`,
                get: get => get(dependency),
            })
        }
        const prefix = Array.from(
            { length: width },
            (_, index) => `dependency-${index}`,
        )
        for (const dependency of prefix) {
            host.define({
                node: dependency,
                get: get => get("chain-0"),
            })
        }
        host.define({ node: "changed", get: () => 1 })
        expect(valueOf(host.read<number>("changed"))).toBe(1)
        const parent: SelectorDefinition<Node, number> = {
            node: "parent",
            get: get => {
                for (const dependency of prefix) get(dependency)
                get(prefix[0]!)
                return 1
            },
        }
        host.define(parent)
        expect(valueOf(host.read<number>("parent"))).toBe(1)

        host.define(parent)
        host.define({ node: "changed", get: () => 2 })
        let firstDependencyServes = 0
        host.setServeEffect(prefix[0]!, () => {
            firstDependencyServes++
            if (firstDependencyServes === 2) {
                expect(valueOf(host.read<number>("changed"))).toBe(2)
            }
        })
        const { recorder, inspect } = createInspectionRecorder()
        const hostRef = recorder.reference(host, "scope")
        const prefixMemos = new Set<SelectorNegativePathMemo<Node>>()
        host.cycleTrace = (
            start,
            target,
            cycleHost,
            session,
            site,
            negativeMemo,
        ) => {
            const path = recorder.findDependencyPath(
                "committed",
                hostRef,
                start,
                target,
                cycleHost,
                session,
                site,
                cycleHost.getSelectorGraphVersion(),
                session.getSelectorGraphPublicationCount(cycleHost),
                false,
                negativeMemo,
            )
            if (site === 0 && negativeMemo !== undefined) {
                prefixMemos.add(negativeMemo)
            }
            return path
        }
        host.selectorDependencyNodeReadNodes.length = 0

        expect(valueOf(host.read<number>("parent"))).toBe(1)
        expect(firstDependencyServes).toBe(2)
        expect(prefixMemos.size).toBe(1)
        expect(host.selectorDependencyNodeReadNodes).toHaveLength(width + depth)
        expect(
            host.selectorDependencyNodeReadNodes.filter(
                node => node === "chain-0",
            ),
        ).toHaveLength(1)
        const searches = inspect
            .export()
            .details.filter(detail => detail.type === "cycle-search")
        expect(searches).toHaveLength(width)
        expect(searches.reduce((sum, search) => sum + search.visits, 0)).toBe(
            depth + 2 * width - 1,
        )
    })

    test("disables negative learning after three disjoint non-terminal proofs", () => {
        const host = new TestHost()
        const width = 4
        const depth = 4
        const prefix = Array.from(
            { length: width },
            (_, branch) => `branch-${branch}-0`,
        )
        for (let branch = 0; branch < width; branch++) {
            host.setLeaf(`leaf-${branch}`, 1)
            for (let index = depth - 1; index >= 0; index--) {
                host.define({
                    node: `branch-${branch}-${index}`,
                    get: get =>
                        get(
                            index + 1 === depth
                                ? `leaf-${branch}`
                                : `branch-${branch}-${index + 1}`,
                        ),
                })
            }
        }
        host.setLeaf("trigger", 1)
        host.define({ node: "changed", get: () => 1 })
        expect(valueOf(host.read<number>("changed"))).toBe(1)
        const parent: SelectorDefinition<Node, number> = {
            node: "parent",
            get: get => {
                for (const dependency of prefix) get(dependency)
                get("trigger")
                return 1
            },
        }
        host.define(parent)
        expect(valueOf(host.read<number>("parent"))).toBe(1)

        host.define(parent)
        host.define({ node: "changed", get: () => 2 })
        let published = false
        host.setServeEffect("trigger", () => {
            if (published) return
            published = true
            expect(valueOf(host.read<number>("changed"))).toBe(2)
        })
        const { recorder, inspect } = createInspectionRecorder()
        const hostRef = recorder.reference(host, "scope")
        const memoEnabled: boolean[] = []
        host.cycleTrace = (
            start,
            target,
            cycleHost,
            session,
            site,
            negativeMemo,
        ) => {
            const path = recorder.findDependencyPath(
                "committed",
                hostRef,
                start,
                target,
                cycleHost,
                session,
                site,
                cycleHost.getSelectorGraphVersion(),
                session.getSelectorGraphPublicationCount(cycleHost),
                false,
                negativeMemo,
            )
            if (site === 0) memoEnabled.push(negativeMemo !== undefined)
            return path
        }

        expect(valueOf(host.read<number>("parent"))).toBe(1)
        expect(memoEnabled).toEqual([true, true, true, false])
        const searches = inspect
            .export()
            .details.filter(
                (detail): detail is CycleSearchInspectionDetail =>
                    detail.type === "cycle-search" &&
                    detail.site === "prefix-revalidation",
            )
        expect(searches).toHaveLength(width)
        expect(searches.reduce((sum, search) => sum + search.visits, 0)).toBe(
            width * depth,
        )
    })

    test("retains two learned closures through terminal noise until later reuse", () => {
        for (const inspected of [false, true]) {
            const host = new TestHost()
            const firstDepth = 16
            const sharedDepth = 32
            host.setLeaf("first-tail", 1)
            host.setLeaf("shared-tail", 1)
            host.setLeaf("trigger", 1)
            for (let index = firstDepth - 1; index >= 0; index--) {
                host.define({
                    node: `first-${index}`,
                    get: get =>
                        get(
                            index + 1 === firstDepth
                                ? "first-tail"
                                : `first-${index + 1}`,
                        ),
                })
            }
            for (let index = sharedDepth - 1; index >= 0; index--) {
                host.define({
                    node: `shared-${index}`,
                    get: get =>
                        get(
                            index + 1 === sharedDepth
                                ? "shared-tail"
                                : `shared-${index + 1}`,
                        ),
                })
            }
            host.define({ node: "first-root", get: get => get("first-0") })
            host.define({ node: "shared-a", get: get => get("shared-0") })
            host.define({ node: "terminal-a", get: () => 1 })
            host.define({ node: "terminal-b", get: () => 1 })
            host.define({ node: "shared-b", get: get => get("shared-0") })
            host.define({ node: "changed", get: () => 1 })
            expect(valueOf(host.read<number>("changed"))).toBe(1)
            const parent: SelectorDefinition<Node, number> = {
                node: "parent",
                get: get => {
                    get("first-root")
                    get("shared-a")
                    get("terminal-a")
                    get("terminal-b")
                    get("shared-b")
                    get("trigger")
                    return 1
                },
            }
            host.define(parent)
            expect(valueOf(host.read<number>("parent"))).toBe(1)

            let inspect:
                | ReturnType<typeof createInspectionRecorder>["inspect"]
                | undefined
            if (inspected) {
                const setup = createInspectionRecorder()
                inspect = setup.inspect
                const hostRef = setup.recorder.reference(host, "scope")
                host.cycleTrace = (
                    start,
                    target,
                    cycleHost,
                    session,
                    site,
                    negativeMemo,
                ) =>
                    setup.recorder.findDependencyPath(
                        "committed",
                        hostRef,
                        start,
                        target,
                        cycleHost,
                        session,
                        site,
                        cycleHost.getSelectorGraphVersion(),
                        session.getSelectorGraphPublicationCount(cycleHost),
                        false,
                        negativeMemo,
                    )
            }

            host.define(parent)
            host.define({ node: "changed", get: () => 2 })
            let published = false
            host.setServeEffect("trigger", () => {
                if (published) return
                published = true
                expect(valueOf(host.read<number>("changed"))).toBe(2)
            })
            host.selectorDependencyNodeReadNodes.length = 0

            expect(valueOf(host.read<number>("parent"))).toBe(1)
            expect(
                host.selectorDependencyNodeReadNodes.filter(
                    node => node === "shared-0",
                ),
            ).toHaveLength(1)
            expect(host.selectorDependencyNodeReadNodes).toHaveLength(
                firstDepth + sharedDepth + 6,
            )
            if (inspect !== undefined) {
                const searches = inspect
                    .export()
                    .details.filter(
                        (detail): detail is CycleSearchInspectionDetail =>
                            detail.type === "cycle-search" &&
                            detail.site === "prefix-revalidation",
                    )
                expect(searches).toHaveLength(5)
                expect(
                    searches.reduce((sum, search) => sum + search.visits, 0),
                ).toBe(firstDepth + sharedDepth + 6)
            }
        }
    })

    test("bounds locked negative learning and resets its miss streak on reuse", () => {
        const host = new TestHost()
        host.setLeaf("shared-tail", 1)
        host.setLeaf("trigger", 1)
        host.define({ node: "shared-hub", get: get => get("shared-tail") })
        for (const node of ["shared-a", "shared-b", "shared-c"]) {
            host.define({ node, get: get => get("shared-hub") })
        }
        host.define({ node: "terminal-a", get: () => 1 })
        host.define({ node: "terminal-b", get: () => 1 })
        for (const node of [
            "disjoint-a",
            "disjoint-b",
            "disjoint-c",
            "disjoint-d",
            "disjoint-e",
            "after-disabled",
        ]) {
            host.setLeaf(`${node}-tail`, 1)
            host.define({
                node: `${node}-child`,
                get: get => get(`${node}-tail`),
            })
            host.define({ node, get: get => get(`${node}-child`) })
        }
        host.define({ node: "changed", get: () => 1 })
        expect(valueOf(host.read<number>("changed"))).toBe(1)
        const prefix = [
            "shared-a",
            "shared-b",
            "terminal-a",
            "disjoint-a",
            "disjoint-b",
            "shared-c",
            "disjoint-c",
            "terminal-b",
            "disjoint-d",
            "disjoint-e",
            "after-disabled",
        ]
        const parent: SelectorDefinition<Node, number> = {
            node: "parent",
            get: get => {
                for (const dependency of prefix) get(dependency)
                get("trigger")
                return 1
            },
        }
        host.define(parent)
        expect(valueOf(host.read<number>("parent"))).toBe(1)

        const setup = createInspectionRecorder()
        const hostRef = setup.recorder.reference(host, "scope")
        const memoEnabled: boolean[] = []
        host.cycleTrace = (
            start,
            target,
            cycleHost,
            session,
            site,
            negativeMemo,
        ) => {
            if (site === 0) memoEnabled.push(negativeMemo !== undefined)
            return setup.recorder.findDependencyPath(
                "committed",
                hostRef,
                start,
                target,
                cycleHost,
                session,
                site,
                cycleHost.getSelectorGraphVersion(),
                session.getSelectorGraphPublicationCount(cycleHost),
                false,
                negativeMemo,
            )
        }

        host.define(parent)
        host.define({ node: "changed", get: () => 2 })
        let published = false
        host.setServeEffect("trigger", () => {
            if (published) return
            published = true
            expect(valueOf(host.read<number>("changed"))).toBe(2)
        })
        host.selectorDependencyNodeReadNodes.length = 0

        expect(valueOf(host.read<number>("parent"))).toBe(1)
        expect(memoEnabled).toEqual([
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            false,
        ])
        expect(
            host.selectorDependencyNodeReadNodes.filter(
                node => node === "shared-hub",
            ),
        ).toHaveLength(1)
    })

    test("a positive prefix proof keeps the canonical path after negative memo pruning", () => {
        for (const inspected of [false, true]) {
            const host = new TestHost()
            host.setLeaf("leaf", 1)
            host.setLeaf("trigger", 1)
            host.define({ node: "dead", get: get => get("leaf") })
            host.define({ node: "safe", get: get => get("dead") })
            host.define({ node: "bridge", get: get => get("leaf") })
            host.define({
                node: "bad",
                get: get => {
                    get("bridge")
                    get("dead")
                    return 1
                },
            })
            expect(valueOf(host.read<number>("bad"))).toBe(1)
            let includeBad = false
            const parent: SelectorDefinition<Node, number> = {
                node: "parent",
                get: get => {
                    get("safe")
                    if (includeBad) get("bad")
                    get("trigger")
                    return 1
                },
            }
            host.define(parent)
            expect(valueOf(host.read<number>("parent"))).toBe(1)
            host.define({ node: "follower", get: get => get("parent") })
            expect(valueOf(host.read<number>("follower"))).toBe(1)

            let inspect:
                | ReturnType<typeof createInspectionRecorder>["inspect"]
                | undefined
            if (inspected) {
                const setup = createInspectionRecorder()
                inspect = setup.inspect
                const hostRef = setup.recorder.reference(host, "scope")
                host.cycleTrace = (
                    start,
                    target,
                    cycleHost,
                    session,
                    site,
                    negativeMemo,
                ) =>
                    setup.recorder.findDependencyPath(
                        "committed",
                        hostRef,
                        start,
                        target,
                        cycleHost,
                        session,
                        site,
                        cycleHost.getSelectorGraphVersion(),
                        session.getSelectorGraphPublicationCount(cycleHost),
                        false,
                        negativeMemo,
                    )
            }

            includeBad = true
            host.define(parent)
            host.define({ node: "bridge", get: get => get("follower") })
            let published = false
            host.setServeEffect("trigger", () => {
                if (published) return
                published = true
                expect(valueOf(host.read<number>("bridge"))).toBe(1)
                host.selectorDependencyNodeReadNodes.length = 0
            })
            host.selectorDependencyNodeReadNodes.length = 0

            const error = errorOf(host.read("parent"))

            expect(error).toBeInstanceOf(SelectorCircularDependencyError)
            expect((error as SelectorCircularDependencyError).path).toEqual([
                "parent",
                "bad",
                "bridge",
                "follower",
                "parent",
            ])
            expect(host.selectorDependencyNodeReadNodes).toEqual([
                "safe",
                "dead",
                "bad",
                "bridge",
                "follower",
                "safe",
                "dead",
            ])
            expect(
                host.records
                    .get("parent")
                    ?.dependencies.map(({ node }) => node),
            ).toEqual(["safe"])
            if (inspect !== undefined) {
                expect(
                    inspect
                        .export()
                        .details.filter(
                            (detail): detail is CycleSearchInspectionDetail =>
                                detail.type === "cycle-search" && detail.found,
                        ),
                ).toEqual([
                    expect.objectContaining({
                        site: "prefix-revalidation",
                        start: "bad",
                        target: "parent",
                        path: ["bad", "bridge", "follower", "parent"],
                    }),
                ])
            }
        }
    })

    test("scratch and hydration hosts retain full-record closure traversal", () => {
        for (const mode of ["scratch", "hydration"] as const) {
            const host = new TestHost(mode)
            host.setLeaf("noise", 1)
            host.define({ node: "parent", get: () => 1 })
            host.define({ node: "right", get: get => get("parent") })
            host.define({
                node: "start",
                get: get => {
                    get("right")
                    get("noise")
                    return 1
                },
            })
            expect(host.getSelectorDependencyNodes).toBeUndefined()
            expect(valueOf(host.read<number>("parent"))).toBe(1)
            expect(valueOf(host.read<number>("start"))).toBe(1)

            host.define({ node: "parent", get: get => get("start") })
            host.selectorRecordReadNodes.length = 0
            const error = errorOf(host.read("parent"))

            expect(error).toBeInstanceOf(SelectorCircularDependencyError)
            expect((error as SelectorCircularDependencyError).path).toEqual([
                "parent",
                "start",
                "right",
                "parent",
            ])
            expect(host.selectorRecordReadNodes).toEqual([
                "parent",
                "start",
                "noise",
                "right",
            ])
        }
    })

    test("does not mistake an out-of-range undefined node for an old edge", () => {
        const host = new TestHost()
        const undefinedNode = undefined as unknown as Node
        host.setLeaf("stable", 1)
        host.define({
            node: "parent",
            get: get => {
                get("stable")
                return 1
            },
        })
        expect(valueOf(host.read<number>("parent"))).toBe(1)
        host.define({
            node: undefinedNode,
            get: get => {
                get("parent")
                return 1
            },
        })
        expect(valueOf(host.read<number>(undefinedNode))).toBe(1)
        host.define({
            node: "parent",
            get: get => {
                get("stable")
                get(undefinedNode)
                return 1
            },
        })

        const error = errorOf(host.read("parent"))
        expect(error).toBeInstanceOf(SelectorCircularDependencyError)
        expect((error as SelectorCircularDependencyError).path).toEqual([
            "parent",
            undefined,
            "parent",
        ])
        expect(
            host.records
                .get("parent")!
                .dependencies.map(dependency => dependency.node),
        ).toEqual(["stable"])
    })

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

    test("a stable parent edge cannot hide a child that dynamically closes the cycle", () => {
        const host = new TestHost()
        host.setLeaf("leaf", 1)
        host.define({ node: "child", get: get => get("leaf") })
        host.define({ node: "parent", get: get => get("child") })
        expect(valueOf(host.read<number>("parent"))).toBe(1)

        host.define({ node: "child", get: get => get("parent") })
        host.markDirty("parent")
        const parentError = errorOf(host.read("parent"))

        expect(parentError).toBeInstanceOf(SelectorGetterError)
        expect(errorOf(host.records.get("child")!.served)).toBeInstanceOf(
            SelectorCircularDependencyError,
        )
        expect(host.records.get("child")?.dependencies).toEqual([])
    })

    test("an old direct edge is rechecked when its child installs a path back through a cached ancestor", () => {
        const host = new TestHost()
        host.setLeaf("leaf", 1)
        host.define({ node: "descendant", get: get => get("leaf") })
        host.define({ node: "selector", get: get => get("descendant") })
        host.define({ node: "cached", get: get => get("selector") })
        expect(valueOf(host.read<number>("cached"))).toBe(1)

        host.define({ node: "descendant", get: get => get("cached") })
        host.markDirty("selector")
        const error = errorOf(host.read("selector"))

        expect(error).toBeInstanceOf(SelectorCircularDependencyError)
        expect((error as SelectorCircularDependencyError).path).toEqual([
            "selector",
            "descendant",
            "cached",
            "selector",
        ])
        expect(host.records.get("selector")?.dependencies).toEqual([])
        expect(host.records.get("descendant")?.dependencies[0]?.node).toBe(
            "cached",
        )
    })

    test("an unchanged direct child is rechecked after an earlier read changes its shared descendant", () => {
        const host = new TestHost()
        host.setLeaf("leaf", 1)
        host.setLeaf("side-effect", 0)
        host.define({ node: "child", get: get => get("shared") })
        host.define({ node: "shared", get: get => get("leaf") })
        host.define({ node: "parent", get: get => get("child") })
        host.define({ node: "cached", get: get => get("parent") })
        expect(valueOf(host.read<number>("cached"))).toBe(1)

        host.define({ node: "shared", get: get => get("cached") })
        host.define({
            node: "parent",
            get: get => {
                get("side-effect")
                return get("child")
            },
        })
        host.setServeEffect("side-effect", session => {
            host.serve("shared", session)
        })
        const error = errorOf(host.read("parent"))

        expect(error).toBeInstanceOf(SelectorCircularDependencyError)
        expect((error as SelectorCircularDependencyError).path).toEqual([
            "parent",
            "child",
            "shared",
            "cached",
            "parent",
        ])
        expect(
            host.records.get("parent")?.dependencies.map(({ node }) => node),
        ).toEqual(["side-effect"])
        expect(host.records.get("child")?.dependencies[0]?.node).toBe("shared")
        expect(host.records.get("shared")?.dependencies[0]?.node).toBe("cached")
    })

    test("a first materialization cannot hide a cached descendant that changes to close the cycle", () => {
        const host = new TestHost()
        host.setLeaf("leaf", 1)
        host.define({ node: "outer", get: get => get("descendant") })
        host.define({ node: "descendant", get: get => get("leaf") })
        expect(valueOf(host.read<number>("descendant"))).toBe(1)
        expect(host.records.has("outer")).toBe(false)

        host.define({ node: "descendant", get: get => get("outer") })
        const outerError = errorOf(host.read("outer"))

        expect(outerError).toBeInstanceOf(SelectorGetterError)
        expect(errorOf(host.records.get("descendant")!.served)).toBeInstanceOf(
            SelectorCircularDependencyError,
        )
        expect(host.records.get("descendant")?.dependencies).toEqual([])
    })

    test("a fresh-session publication revalidates an earlier new prefix edge", () => {
        const host = new TestHost()
        host.define({ node: "parent", get: () => 1 })
        host.define({ node: "changed", get: () => 1 })
        host.define({ node: "new-edge", get: get => get("changed") })
        host.define({ node: "cached", get: get => get("parent") })
        host.define({ node: "later", get: () => 1 })
        expect(valueOf(host.read<number>("new-edge"))).toBe(1)
        expect(valueOf(host.read<number>("cached"))).toBe(1)
        expect(valueOf(host.read<number>("later"))).toBe(1)

        host.define({
            node: "parent",
            get: get => {
                get("new-edge")
                get("later")
                return 1
            },
        })
        host.define({
            node: "later",
            get: () => {
                host.define({
                    node: "changed",
                    get: get => get("cached"),
                })
                expect(valueOf(host.read<number>("changed"))).toBe(1)
                return 1
            },
        })

        const error = errorOf(host.read("parent"))

        expect(error).toBeInstanceOf(SelectorCircularDependencyError)
        expect((error as SelectorCircularDependencyError).path).toEqual([
            "parent",
            "new-edge",
            "changed",
            "cached",
            "parent",
        ])
        expect(host.records.get("parent")?.dependencies).toEqual([])
    })

    test("a same-session publication sees an already-accepted parent prefix", () => {
        const host = new TestHost()
        host.define({ node: "parent", get: () => 1 })
        host.define({ node: "changed", get: () => 1 })
        host.define({ node: "new-edge", get: get => get("changed") })
        host.define({ node: "cached", get: get => get("parent") })
        host.define({ node: "later", get: () => 1 })
        expect(valueOf(host.read<number>("new-edge"))).toBe(1)
        expect(valueOf(host.read<number>("cached"))).toBe(1)
        expect(valueOf(host.read<number>("later"))).toBe(1)

        host.define({
            node: "parent",
            get: get => {
                get("new-edge")
                get("later")
                return 1
            },
        })
        host.define({
            node: "changed",
            get: get => get("cached"),
        })
        host.setServeEffect("later", session => {
            host.serve("changed", session)
        })

        expect(valueOf(host.read<number>("parent"))).toBe(1)
        const changedError = errorOf(host.records.get("changed")!.served)
        expect(changedError).toBeInstanceOf(SelectorCircularDependencyError)
        expect((changedError as SelectorCircularDependencyError).path).toEqual([
            "changed",
            "cached",
            "parent",
            "new-edge",
            "changed",
        ])
        expect(host.records.get("changed")?.dependencies).toEqual([])
        expect(
            host.records.get("parent")?.dependencies.map(({ node }) => node),
        ).toEqual(["new-edge", "later"])
    })

    test("finalization revalidates a prefix changed after the last supplied get", () => {
        const host = new TestHost()
        host.define({ node: "parent", get: () => 1 })
        host.define({ node: "changed", get: () => 1 })
        host.define({ node: "new-edge", get: get => get("changed") })
        host.define({ node: "cached", get: get => get("parent") })
        expect(valueOf(host.read<number>("new-edge"))).toBe(1)
        expect(valueOf(host.read<number>("cached"))).toBe(1)

        host.define({
            node: "parent",
            get: get => {
                get("new-edge")
                host.define({
                    node: "changed",
                    get: changedGet => changedGet("cached"),
                })
                expect(valueOf(host.read<number>("changed"))).toBe(1)
                return 1
            },
        })

        const error = errorOf(host.read("parent"))

        expect(error).toBeInstanceOf(SelectorCircularDependencyError)
        expect((error as SelectorCircularDependencyError).path).toEqual([
            "parent",
            "new-edge",
            "changed",
            "cached",
            "parent",
        ])
        expect(host.records.get("parent")?.dependencies).toEqual([])
    })

    test("a cold parent proves its first edge after a nested fresh-session publication", () => {
        const host = new TestHost()
        let nestedParentRead = false
        host.define({
            node: "parent",
            get: get => (nestedParentRead ? 1 : get("new-edge")),
        })
        host.define({ node: "changed", get: () => 1 })
        host.define({ node: "new-edge", get: get => get("changed") })
        host.define({ node: "cached", get: get => get("parent") })
        expect(valueOf(host.read<number>("new-edge"))).toBe(1)
        expect(host.records.has("parent")).toBe(false)

        host.setServeEffect("new-edge", () => {
            host.define({
                node: "changed",
                get: get => get("cached"),
            })
            nestedParentRead = true
            try {
                expect(valueOf(host.read<number>("changed"))).toBe(1)
            } finally {
                nestedParentRead = false
            }
        })

        const error = errorOf(host.read("parent"))

        expect(error).toBeInstanceOf(SelectorCircularDependencyError)
        expect((error as SelectorCircularDependencyError).path).toEqual([
            "parent",
            "new-edge",
            "changed",
            "cached",
            "parent",
        ])
        expect(host.records.get("parent")?.dependencies).toEqual([])
    })

    test("a warm parent proves a newly materialized dependency after its same-session publication", () => {
        const host = new TestHost()
        host.define({ node: "parent", get: () => 1 })
        host.define({ node: "cached", get: get => get("parent") })
        expect(valueOf(host.read<number>("cached"))).toBe(1)

        host.define({ node: "fresh", get: get => get("cached") })
        host.define({ node: "parent", get: get => get("fresh") })

        const error = errorOf(host.read("parent"))

        expect(error).toBeInstanceOf(SelectorCircularDependencyError)
        expect((error as SelectorCircularDependencyError).path).toEqual([
            "parent",
            "fresh",
            "cached",
            "parent",
        ])
        expect(host.records.get("parent")?.dependencies).toEqual([])
        expect(host.records.get("fresh")?.dependencies[0]?.node).toBe("cached")
    })

    test("comparator thenable inspection preserves a newly latched prefix cycle", () => {
        const host = new TestHost()
        let readNewEdge = false
        let publishDuringInspection = false
        host.define({ node: "changed", get: () => 1 })
        host.define({ node: "new-edge", get: get => get("changed") })
        host.define({ node: "cached", get: get => get("parent") })
        host.define({
            node: "parent",
            get: get => {
                if (readNewEdge) get("new-edge")
                return 1
            },
            equal: (() => {
                if (!publishDuringInspection) return false
                return {
                    get then() {
                        host.define({
                            node: "changed",
                            get: get => get("cached"),
                        })
                        expect(valueOf(host.read<number>("changed"))).toBe(1)
                        return undefined
                    },
                }
            }) as (previous: number, next: number) => boolean,
        })
        expect(valueOf(host.read<number>("parent"))).toBe(1)
        expect(valueOf(host.read<number>("cached"))).toBe(1)

        readNewEdge = true
        publishDuringInspection = true
        host.markDirty("parent")
        const error = errorOf(host.read("parent"))

        expect(error).toBeInstanceOf(SelectorCircularDependencyError)
        expect((error as SelectorCircularDependencyError).path).toEqual([
            "parent",
            "new-edge",
            "changed",
            "cached",
            "parent",
        ])
        expect(host.records.get("parent")?.dependencies).toEqual([])
    })

    test("a latched cycle still truncates a prefix invalidated by a later fresh session", () => {
        const host = new TestHost()
        let firstCycle: unknown
        host.define({ node: "parent", get: () => 1 })
        host.define({ node: "changed", get: () => 1 })
        host.define({ node: "new-edge", get: get => get("changed") })
        host.define({ node: "cached", get: get => get("parent") })
        expect(valueOf(host.read<number>("new-edge"))).toBe(1)
        expect(valueOf(host.read<number>("cached"))).toBe(1)

        host.define({
            node: "parent",
            get: get => {
                get("new-edge")
                try {
                    get("parent")
                } catch (error) {
                    firstCycle = error
                }
                host.define({
                    node: "changed",
                    get: changedGet => changedGet("cached"),
                })
                expect(valueOf(host.read<number>("changed"))).toBe(1)
                return 1
            },
        })

        const error = errorOf(host.read("parent"))

        expect(error).toBe(firstCycle)
        expect((error as SelectorCircularDependencyError).path).toEqual([
            "parent",
            "parent",
        ])
        expect(host.records.get("parent")?.dependencies).toEqual([])
    })

    test("resamples a replayed dependency after reentrant append and net-zero prefix truncation", () => {
        const control = Object.freeze({ code: "CONTROL" })
        const host = new TestHost("persistent-post")
        let nestedParent = false
        let suppliedGet: (<Value>(node: Node) => Value) | undefined
        let invalidate = false
        host.define({ node: "edge", get: () => 1 })
        host.define({
            node: "parent",
            get: get => {
                if (nestedParent) return 1
                suppliedGet = get
                return get<number>("edge")
            },
        })
        expect(valueOf(host.read<number>("parent"))).toBe(1)

        host.setServeEffect("edge", session => {
            if (!invalidate) return
            invalidate = false
            suppliedGet?.<number>("edge")
            session.latchControlFault(control)
            nestedParent = true
            host.markDirty("parent")
            try {
                expect(valueOf(host.read<number>("parent"))).toBe(1)
            } finally {
                nestedParent = false
            }
            host.define({ node: "edge", get: get => get<number>("parent") })
            expect(valueOf(host.read<number>("edge"))).toBe(1)
        })
        host.markDirty("parent")
        invalidate = true

        expect(errorOf(host.read("parent"))).toBe(control)
        expect(host.records.get("parent")?.dependencies).toEqual([])
    })

    test("removes a preaccepted dependency when serving its duplicate invalidates the prefix", () => {
        const control = Object.freeze({ code: "CONTROL" })
        const host = new TestHost("persistent-post")
        let nestedParent = false
        let duplicate = false
        let serveCount = 0
        host.define({ node: "edge", get: () => 1 })
        host.define({
            node: "parent",
            get: get => {
                if (nestedParent) return 1
                const result = get<number>("edge")
                if (duplicate) get("edge")
                return result
            },
        })
        expect(valueOf(host.read<number>("parent"))).toBe(1)

        host.setServeEffect("edge", session => {
            serveCount++
            if (serveCount !== 2) return
            session.latchControlFault(control)
            nestedParent = true
            host.markDirty("parent")
            try {
                expect(valueOf(host.read<number>("parent"))).toBe(1)
            } finally {
                nestedParent = false
            }
            host.define({ node: "edge", get: get => get<number>("parent") })
            expect(valueOf(host.read<number>("edge"))).toBe(1)
        })
        duplicate = true
        host.markDirty("parent")

        expect(errorOf(host.read("parent"))).toBe(control)
        expect(host.records.get("parent")?.dependencies).toEqual([])
    })

    test("prefix truncation removes stale transient edges before later same-session proofs", () => {
        const host = new TestHost()
        let parentSession: SelectorEvaluationSession<Node> | undefined
        let nestedChild: ServedSelectorOutcome<Token> | undefined
        let firstCycle: unknown
        host.setLeaf("a", 1)
        host.setLeaf("trigger", 0)
        host.define({ node: "parent", get: () => 1 })
        host.define({ node: "x", get: get => get("parent") })
        host.define({ node: "d", get: get => get("parent") })
        host.define({ node: "child", get: get => get("x") })
        host.define({ node: "b", get: () => 1 })
        expect(valueOf(host.read<number>("child"))).toBe(1)
        expect(valueOf(host.read<number>("d"))).toBe(1)
        expect(valueOf(host.read<number>("b"))).toBe(1)

        host.setServeEffect("trigger", session => {
            parentSession = session
            host.define({ node: "b", get: get => get("child") })
            expect(valueOf(host.read<number>("b"))).toBe(1)
        })
        host.define({
            node: "parent",
            get: get => {
                get("a")
                get("b")
                try {
                    get("trigger")
                } catch (error) {
                    firstCycle = error
                }
                host.define({ node: "child", get: childGet => childGet("d") })
                nestedChild = host.serve("child", parentSession!)
                return 1
            },
        })

        const parentError = errorOf(host.read("parent"))

        expect(parentError).toBe(firstCycle)
        expect((parentError as SelectorCircularDependencyError).path).toEqual([
            "parent",
            "b",
            "child",
            "x",
            "parent",
        ])
        expect(
            host.records.get("parent")?.dependencies.map(({ node }) => node),
        ).toEqual(["a"])
        expect(valueOf(nestedChild!)).toBe(1)
        expect(host.records.get("child")?.dependencies[0]?.node).toBe("d")
    })

    test("a child revalidates an invalidated ancestor prefix before its next proof", () => {
        const host = new TestHost()
        host.define({ node: "p", get: () => 1 })
        host.define({ node: "b", get: () => 1 })
        host.define({ node: "c", get: () => 1 })
        host.define({ node: "q", get: get => get("c") })
        host.define({ node: "x", get: get => get("p") })
        host.define({ node: "d", get: get => get("p") })
        for (const node of ["p", "b", "c", "q", "x", "d"] as const) {
            expect(valueOf(host.read<number>(node))).toBe(1)
        }

        host.define({
            node: "p",
            get: get => {
                get("b")
                return get("c")
            },
        })
        host.define({
            node: "c",
            get: get => {
                host.define({
                    node: "b",
                    get: freshGet => {
                        freshGet("x")
                        return freshGet("q")
                    },
                })
                expect(valueOf(host.read<number>("b"))).toBe(1)
                return get("d")
            },
        })

        const parentError = errorOf(host.read("p"))

        expect(parentError).toBeInstanceOf(SelectorCircularDependencyError)
        expect((parentError as SelectorCircularDependencyError).path).toEqual([
            "p",
            "b",
            "x",
            "p",
        ])
        expect(host.records.get("p")?.dependencies).toEqual([])
        expect(valueOf(host.records.get("c")!.served)).toBe(1)
        expect(host.records.get("c")?.dependencies[0]?.node).toBe("d")
    })

    test("selector publication attribution remains isolated across two hosts", () => {
        const session = new SelectorEvaluationSession<Node>()
        const first = new TestHost()
        const second = new TestHost()

        expect(session.getSelectorGraphPublicationCount(first)).toBe(0)
        expect(session.getSelectorGraphPublicationCount(second)).toBe(0)
        session.noteSelectorGraphPublication(first)
        session.noteSelectorGraphPublication(second)
        session.noteSelectorGraphPublication(second)
        session.noteSelectorGraphPublication(first)

        expect(session.getSelectorGraphPublicationCount(first)).toBe(2)
        expect(session.getSelectorGraphPublicationCount(second)).toBe(2)
    })

    test("active selector frames remain isolated across two hosts", () => {
        const first = new TestHost()
        const second = new TestHost()
        let child: ServedSelectorOutcome<Token, number> | undefined

        first.setLeaf("bridge", 1)
        first.define({ node: "outer", get: get => get("bridge") })
        second.define({ node: "outer", get: () => 2 })
        second.define({ node: "child", get: get => get("outer") })
        first.setServeEffect("bridge", session => {
            child = second.serve("child", session) as ServedSelectorOutcome<
                Token,
                number
            >
        })

        expect(valueOf(first.read<number>("outer"))).toBe(1)
        expect(valueOf(child!)).toBe(2)
        expect(
            second.records.get("child")?.dependencies.map(({ node }) => node),
        ).toEqual(["outer"])
    })

    test("selector-record removal must preserve graph-closed absence", () => {
        const host = new TestHost()
        host.define({ node: "parent", get: () => 1 })
        host.define({ node: "cached", get: get => get("parent") })
        expect(valueOf(host.read<number>("cached"))).toBe(1)

        host.records.delete("parent")

        expect(() => host.getSelectorRecord("parent")).toThrow(
            "TestHost selector-record absence is not graph-closed",
        )
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

    test("a thrown thenable cannot use a captured get during containment", () => {
        const host = new TestHost()
        let capturedGet: ((node: Node) => unknown) | undefined
        let thenCalls = 0
        host.setLeaf("late", 1)
        const thrownThenable = {
            then() {
                thenCalls++
                capturedGet!("late")
            },
        }
        host.define({
            node: "derived",
            get: get => {
                capturedGet = get
                throw thrownThenable
            },
        })

        const error = errorOf(host.read("derived"))

        expect(error).toBeInstanceOf(InvalidSynchronousSelectorResultError)
        expect(thenCalls).toBe(1)
        expect(host.leafReads.get("late")).toBeUndefined()
        expect(host.records.get("derived")?.dependencies).toEqual([])
    })

    for (const accessorKind of ["nonfunction", "throwing"] as const) {
        test(`a thrown ${accessorKind} then accessor cannot use a captured get during inspection`, () => {
            const host = new TestHost()
            let capturedGet: ((node: Node) => unknown) | undefined
            let thenGets = 0
            host.setLeaf("late", 1)
            const thrownValue = {
                get then() {
                    thenGets++
                    capturedGet!("late")
                    if (accessorKind === "throwing") {
                        throw new Error("hostile then getter")
                    }
                    return undefined
                },
            }
            host.define({
                node: "derived",
                get: get => {
                    capturedGet = get
                    throw thrownValue
                },
            })

            const error = errorOf(host.read("derived"))

            expect(error).toBeInstanceOf(SelectorGetterError)
            expect((error as SelectorGetterError).cause).toBeInstanceOf(
                SelectorReadRevokedError,
            )
            expect(thenGets).toBe(1)
            expect(host.leafReads.get("late")).toBeUndefined()
            expect(host.records.get("derived")?.dependencies).toEqual([])
        })
    }

    test("returned then inspection sees an already revoked captured get", () => {
        const host = new TestHost()
        let capturedGet: ((node: Node) => unknown) | undefined
        let inspectionError: unknown
        host.setLeaf("late", 1)
        const returned = {
            get then() {
                try {
                    capturedGet!("late")
                } catch (error) {
                    inspectionError = error
                }
                return undefined
            },
        }
        host.define({
            node: "derived",
            get: get => {
                capturedGet = get
                return returned
            },
        })

        expect(valueOf(host.read<typeof returned>("derived"))).toBe(returned)
        expect(inspectionError).toBeInstanceOf(SelectorReadRevokedError)
        expect(host.leafReads.get("late")).toBeUndefined()
        expect(host.records.get("derived")?.dependencies).toEqual([])
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
