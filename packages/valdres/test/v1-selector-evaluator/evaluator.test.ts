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
import { atom, selector } from "../../src/index"
import { createInspectableStore } from "../../src/inspect"
import {
    createCommittedStoreTreeDomain,
    type InternalStoreTreeTrace,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import { StoreScopeNode } from "../../src/v1-internal/committed-store-tree/scope-node"
import type {
    SelectorComparisonBaseline,
    SelectorDefinition,
    SelectorEvaluationHost,
    SelectorEvaluationProposal,
    SelectorGraphEdgeAddition,
    SelectorGraphObservation,
    SelectorNewEdgeProofDiagnostics,
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
    newEdgeProofDiagnostics: SelectorNewEdgeProofDiagnostics | undefined
    #nextToken = 1
    #selectorGraphVersion = 0
    #activeSession: SelectorEvaluationSession<Node> | undefined
    #disposed = false
    #graphObserverCount = 0
    #observedEdges: SelectorGraphEdgeAddition<Node>[] | undefined
    #observationIncomplete = false
    graphObservationBegins = 0
    graphObservationCloses = 0
    graphObservationTakes = 0

    constructor(
        readonly mode: HostMode = "persistent-pre",
        readonly options: Readonly<{
            liveRecords?: Map<Node, TestRecord>
            comparisonRecords?: Map<Node, TestRecord>
            observeSelectorGraph?: boolean
            maxObservedEdges?: number
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
                this.newEdgeProofDiagnostics,
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
        if (this.#graphObserverCount > 0 && !this.#observationIncomplete) {
            const previousNodes = new Set(
                previous?.dependencies.map(dependency => dependency.node),
            )
            for (const dependency of proposal.dependencies) {
                if (
                    !this.definitions.has(dependency.node) ||
                    previousNodes.has(dependency.node)
                ) {
                    continue
                }
                const observed = this.#observedEdges
                if (
                    observed === undefined ||
                    observed.length >= (this.options.maxObservedEdges ?? 4_096)
                ) {
                    this.#observationIncomplete = true
                    this.#observedEdges = []
                    break
                }
                observed.push(
                    Object.freeze({ tail: node, head: dependency.node }),
                )
            }
        }
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

    beginSelectorGraphObservation(
        newlyAcceptedDependency: Node,
    ): SelectorGraphObservation<Node> | undefined {
        if (!this.definitions.has(newlyAcceptedDependency)) return undefined
        this.graphObservationBegins++
        const enabled =
            this.options.observeSelectorGraph ??
            (this.mode === "persistent-pre" || this.mode === "persistent-post")
        if (!enabled) {
            let closed = false
            return Object.freeze({
                takeAddedEdges: () => undefined,
                close: () => {
                    if (closed) return
                    closed = true
                    this.graphObservationCloses++
                },
            })
        }
        if (this.#graphObserverCount === 0) {
            this.#observedEdges = []
            this.#observationIncomplete = false
        }
        this.#graphObserverCount++
        let cursor = this.#observedEdges?.length ?? 0
        let closed = false
        return Object.freeze({
            takeAddedEdges: () => {
                this.graphObservationTakes++
                if (closed || this.#observationIncomplete) return undefined
                const observed = this.#observedEdges
                if (observed === undefined) return undefined
                if (cursor === observed.length) return Object.freeze([])
                const additions = Object.freeze(observed.slice(cursor))
                cursor = observed.length
                return additions
            },
            close: () => {
                if (closed) return
                closed = true
                this.graphObservationCloses++
                this.#graphObserverCount--
                if (this.#graphObserverCount === 0) {
                    this.#observedEdges = undefined
                    this.#observationIncomplete = false
                }
            },
        })
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
                acceptedPrefixLength,
            ) =>
                setup.recorder.findDependencyPath(
                    scenario.hostKind,
                    hostRef,
                    start,
                    target,
                    cycleHost,
                    session,
                    site,
                    acceptedPrefixLength,
                    cycleHost.getSelectorGraphVersion(),
                    session.getSelectorGraphPublicationCount(cycleHost),
                    false,
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
                expect(
                    searches.find(
                        search =>
                            search.found &&
                            search.site === "prefix-revalidation",
                    ),
                ).toMatchObject({
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
            acceptedPrefixLength,
        ) =>
            recorder.findDependencyPath(
                "committed",
                hostRef,
                start,
                target,
                cycleHost,
                session,
                site,
                acceptedPrefixLength,
                cycleHost.getSelectorGraphVersion(),
                session.getSelectorGraphPublicationCount(cycleHost),
                false,
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

    test("replays exact foreign edge additions instead of a growing accepted prefix", () => {
        const run = (observeSelectorGraph: boolean) => {
            const host = new TestHost("persistent-pre", {
                observeSelectorGraph,
            })
            const prefixWidth = 60
            const closureDepth = 20
            const publicationCount = 15
            host.setLeaf("closure-tail", 1)
            for (let index = closureDepth - 1; index >= 0; index--) {
                host.define({
                    node: `closure-${index}`,
                    get: get =>
                        get(
                            index + 1 === closureDepth
                                ? "closure-tail"
                                : `closure-${index + 1}`,
                        ),
                })
            }
            const prefix = Array.from(
                { length: prefixWidth },
                (_, index) => `prefix-${index}`,
            )
            for (const dependency of prefix) {
                host.define({
                    node: dependency,
                    get: get => get("closure-0"),
                })
                expect(valueOf(host.read<number>(dependency))).toBe(1)
            }
            for (let index = 0; index < publicationCount; index++) {
                host.define({ node: `edge-head-${index}`, get: () => 1 })
                host.define({ node: `foreign-${index}`, get: () => 1 })
                expect(valueOf(host.read<number>(`edge-head-${index}`))).toBe(1)
                expect(valueOf(host.read<number>(`foreign-${index}`))).toBe(1)
            }

            const parent: SelectorDefinition<Node, number> = {
                node: "parent",
                get: get => {
                    for (const dependency of prefix) get(dependency)
                    return 1
                },
            }
            host.define(parent)
            expect(valueOf(host.read<number>("parent"))).toBe(1)

            const batchAtPrefix = Array.from(
                { length: publicationCount },
                (_, index) =>
                    14 +
                    Math.floor((index * (58 - 14)) / (publicationCount - 1)),
            )
            for (let index = 0; index < publicationCount; index++) {
                host.define({
                    node: `foreign-${index}`,
                    get: get => get(`edge-head-${index}`),
                })
                const trigger = prefix[batchAtPrefix[index]!]!
                host.setServeEffect(trigger, () => {
                    expect(valueOf(host.read<number>(`foreign-${index}`))).toBe(
                        1,
                    )
                })
            }

            const searches = [0, 0, 0]
            const visits = [0, 0, 0]
            host.cycleTrace = (start, target, cycleHost, session, site) => {
                searches[site]++
                const pending = [start]
                const visited = new Set<Node>(pending)
                while (pending.length > 0) {
                    const node = pending.pop()!
                    visits[site]++
                    if (Object.is(node, target)) return Object.freeze([node])
                    const transient = session.getTransientDependencies(
                        cycleHost,
                        node,
                    )
                    const dependencies =
                        transient?.map(dependency => dependency.node) ??
                        cycleHost.getSelectorDependencyNodes?.(node) ??
                        []
                    for (const dependency of dependencies) {
                        if (visited.has(dependency)) continue
                        visited.add(dependency)
                        pending.push(dependency)
                    }
                }
                return undefined
            }
            host.markDirty("parent")
            expect(valueOf(host.read<number>("parent"))).toBe(1)
            return { searches, visits }
        }

        const fallback = run(false)
        const delta = run(true)

        expect(fallback.searches).toEqual([534, 61, 0])
        expect(fallback.visits).toEqual([11_214, 981, 0])
        expect(delta.searches).toEqual([0, 61, 15])
        expect(delta.visits).toEqual([0, 981, 15])
    })

    test("a positive delta proof falls back to canonical first-read blame", () => {
        const host = new TestHost("persistent-pre", {
            observeSelectorGraph: true,
        })
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
        const setup = createInspectionRecorder()
        const hostRef = setup.recorder.reference(host, "scope")
        host.cycleTrace = (
            start,
            target,
            cycleHost,
            session,
            site,
            acceptedPrefixLength,
        ) =>
            setup.recorder.findDependencyPath(
                "committed",
                hostRef,
                start,
                target,
                cycleHost,
                session,
                site,
                acceptedPrefixLength,
                cycleHost.getSelectorGraphVersion(),
                session.getSelectorGraphPublicationCount(cycleHost),
                false,
            )

        const error = errorOf(host.read("parent"))

        expect(error).toBeInstanceOf(SelectorCircularDependencyError)
        expect((error as SelectorCircularDependencyError).path).toEqual([
            "parent",
            "new-edge",
            "changed",
            "cached",
            "parent",
        ])
        expect(
            host.records.get("parent")?.dependencies.map(({ node }) => node),
        ).toEqual([])
        const positiveProofs = setup.inspect
            .export()
            .details.filter(
                (detail): detail is CycleSearchInspectionDetail =>
                    detail.type === "cycle-search" && detail.found,
            )
        expect(positiveProofs.map(proof => proof.site)).toEqual([
            "topology-delta-proof",
            "prefix-revalidation",
        ])
        expect(positiveProofs.map(proof => proof.acceptedPrefixLength)).toEqual(
            [1, 1],
        )
        expect(positiveProofs[1]).toMatchObject({
            start: "new-edge",
            target: "parent",
            path: ["new-edge", "changed", "cached", "parent"],
        })
    })

    test("a committed scope turns a positive delta signal into canonical prefix blame", () => {
        const domain = createCommittedStoreTreeDomain()
        const setup = createInspectionRecorder()
        let scope: StoreScopeNode | undefined
        const baseTrace = setup.trace
        const trace = ((
            code: number,
            first?: unknown,
            second?: unknown,
            third?: unknown,
        ) => {
            if (code === 0 && scope === undefined) {
                scope = second as StoreScopeNode
            }
            baseTrace(code, first, second, third)
        }) as InternalStoreTreeTrace
        Object.assign(trace, { evaluate: baseTrace.evaluate })
        const store = domain.createStoreTree(setup.instrumentation, trace)
        const parentGate = domain.atom(false, {
            name: "committed-delta/parent-gate",
        })
        const trigger = domain.atom(0, { name: "committed-delta/trigger" })
        let closeCycle = false
        let parent!: ReturnType<typeof domain.selector<number>>
        let cached!: ReturnType<typeof domain.selector<number>>
        const changing = domain.selector(
            get => {
                get(trigger)
                return closeCycle ? get(cached) : 1
            },
            { name: "committed-delta/changing" },
        )
        parent = domain.selector(
            get => {
                if (!get(parentGate)) return 1
                const value = get(changing)
                // Drive the real propagation coordinator's fresh-session path
                // after `changing` is already in the parent's transient prefix.
                closeCycle = true
                scope!.markDependents(trigger)
                scope!.serve(changing, new SelectorEvaluationSession())
                return value
            },
            { name: "committed-delta/parent" },
        )
        cached = domain.selector(get => get(parent), {
            name: "committed-delta/cached",
        })

        expect(store.get(changing)).toBe(1)
        expect(store.get(cached)).toBe(1)
        setup.inspect.reset()
        store.txn(
            transaction => transaction.set(parentGate, true),
            "positive committed delta",
        )

        let thrown: unknown
        try {
            store.get(parent)
        } catch (error) {
            thrown = error
        }
        expect(thrown).toBeInstanceOf(SelectorCircularDependencyError)
        expect((thrown as SelectorCircularDependencyError).path).toEqual([
            parent,
            changing,
            cached,
            parent,
        ])
        const positiveProofs = setup.inspect
            .export()
            .details.filter(
                (detail): detail is CycleSearchInspectionDetail =>
                    detail.type === "cycle-search" && detail.found,
            )
        expect(positiveProofs.map(proof => proof.site)).toEqual([
            "topology-delta-proof",
            "prefix-revalidation",
        ])
        expect(positiveProofs.map(proof => proof.acceptedPrefixLength)).toEqual(
            [2, 2],
        )
        expect(
            positiveProofs[1]?.path?.map(value =>
                typeof value === "object" && value !== null && "name" in value
                    ? value.name
                    : undefined,
            ),
        ).toEqual([
            "committed-delta/changing",
            "committed-delta/cached",
            "committed-delta/parent",
        ])
    })

    test("an incomplete delta interval falls back and the next observation resets", () => {
        const host = new TestHost("persistent-pre", {
            observeSelectorGraph: true,
            maxObservedEdges: 1,
        })
        host.setLeaf("trigger", 1)
        for (const node of [
            "safe",
            "head-a",
            "head-b",
            "large",
            "small-head",
            "small",
        ]) {
            host.define({ node, get: () => 1 })
            expect(valueOf(host.read<number>(node))).toBe(1)
        }
        const parent: SelectorDefinition<Node, number> = {
            node: "parent",
            get: get => {
                get("safe")
                get("trigger")
                return 1
            },
        }
        host.define(parent)
        expect(valueOf(host.read<number>("parent"))).toBe(1)
        const sites: number[] = []
        host.cycleTrace = (_start, _target, _host, _session, site) => {
            sites.push(site)
            return undefined
        }

        host.define({
            node: "large",
            get: get => {
                get("head-a")
                get("head-b")
                return 1
            },
        })
        host.define(parent)
        host.setServeEffect("trigger", () => {
            expect(valueOf(host.read<number>("large"))).toBe(1)
        })
        expect(valueOf(host.read<number>("parent"))).toBe(1)
        expect(sites).toContain(0)

        sites.length = 0
        host.define({ node: "small", get: get => get("small-head") })
        host.define(parent)
        host.setServeEffect("trigger", () => {
            expect(valueOf(host.read<number>("small"))).toBe(1)
        })
        expect(valueOf(host.read<number>("parent"))).toBe(1)
        expect(sites).toContain(2)
        expect(sites).not.toContain(0)
    })

    test("edge removals and topology-identical publications skip prefix replay", () => {
        const host = new TestHost("persistent-pre", {
            observeSelectorGraph: true,
        })
        host.setLeaf("trigger", 1)
        host.define({ node: "head", get: () => 1 })
        host.define({ node: "foreign", get: get => get("head") })
        host.define({ node: "safe", get: () => 1 })
        for (const node of ["head", "foreign", "safe"]) {
            expect(valueOf(host.read<number>(node))).toBe(1)
        }
        const parent: SelectorDefinition<Node, number> = {
            node: "parent",
            get: get => {
                get("safe")
                get("trigger")
                return 1
            },
        }
        host.define(parent)
        expect(valueOf(host.read<number>("parent"))).toBe(1)
        host.define({ node: "foreign", get: () => 1 })
        host.define(parent)
        host.setServeEffect("trigger", () => {
            expect(valueOf(host.read<number>("foreign"))).toBe(1)
        })
        const sites: number[] = []
        host.cycleTrace = (_start, _target, _host, _session, site) => {
            sites.push(site)
            return undefined
        }

        expect(valueOf(host.read<number>("parent"))).toBe(1)
        expect(sites).not.toContain(0)
        expect(sites).not.toContain(2)

        sites.length = 0
        host.define({ node: "foreign", get: () => 1 })
        host.define(parent)
        expect(valueOf(host.read<number>("parent"))).toBe(1)
        expect(sites).not.toContain(0)
        expect(sites).not.toContain(2)
    })

    test("opens graph observations lazily and closes them on every outcome", () => {
        const host = new TestHost("persistent-pre", {
            observeSelectorGraph: true,
        })
        host.setLeaf("leaf", 1)
        host.define({ node: "empty", get: () => 1 })
        expect(valueOf(host.read<number>("empty"))).toBe(1)
        expect(host.graphObservationBegins).toBe(0)
        expect(host.graphObservationCloses).toBe(0)

        host.define({ node: "atom-only", get: get => get("leaf") })
        expect(valueOf(host.read<number>("atom-only"))).toBe(1)
        expect(host.graphObservationBegins).toBe(0)
        expect(host.graphObservationCloses).toBe(0)

        host.define({ node: "child", get: get => get("leaf") })
        expect(valueOf(host.read<number>("child"))).toBe(1)
        expect(host.graphObservationBegins).toBe(0)
        expect(host.graphObservationCloses).toBe(0)

        host.define({ node: "value", get: get => get("child") })
        expect(valueOf(host.read<number>("value"))).toBe(1)
        expect(host.graphObservationBegins).toBe(1)
        expect(host.graphObservationCloses).toBe(1)

        const failure = Object.freeze({ code: "EXPECTED" })
        host.define({
            node: "error",
            get: get => {
                get("child")
                throw failure
            },
        })
        expect(errorOf(host.read("error"))).toBeInstanceOf(SelectorGetterError)
        expect(host.graphObservationBegins).toBe(2)
        expect(host.graphObservationCloses).toBe(2)
    })

    test("committed graph observations keep independent cursors and release on record drop", () => {
        const domain = createCommittedStoreTreeDomain()
        let scope: StoreScopeNode | undefined
        const trace = ((code: number, _first?: unknown, second?: unknown) => {
            if (code === 0 && scope === undefined) {
                scope = second as StoreScopeNode
            }
        }) as InternalStoreTreeTrace
        const store = domain.createStoreTree(undefined, trace)
        const firstHead = domain.selector(() => 1)
        const firstTail = domain.selector(get => get(firstHead))
        const secondHead = domain.selector(() => 2)
        const secondTail = domain.selector(get => get(secondHead))
        const thirdHead = domain.selector(() => 3)
        const thirdTail = domain.selector(get => get(thirdHead))
        const root = scope!

        const outer = root.beginSelectorGraphObservation(firstHead)!
        expect(store.get(firstTail)).toBe(1)
        const inner = root.beginSelectorGraphObservation(secondHead)!
        expect(store.get(secondTail)).toBe(2)
        expect(outer.takeAddedEdges()).toEqual([
            { tail: firstTail, head: firstHead },
            { tail: secondTail, head: secondHead },
        ])
        expect(inner.takeAddedEdges()).toEqual([
            { tail: secondTail, head: secondHead },
        ])
        outer.close()
        outer.close()
        expect(store.get(thirdTail)).toBe(3)
        expect(inner.takeAddedEdges()).toEqual([
            { tail: thirdTail, head: thirdHead },
        ])

        const versionBeforeDrop = root.getSelectorGraphVersion()
        root.dropRecords()
        expect(root.getSelectorGraphVersion()).toBe(versionBeforeDrop + 1)
        expect(inner.takeAddedEdges()).toBeUndefined()
        inner.close()

        const next = root.beginSelectorGraphObservation(firstHead)!
        expect(next.takeAddedEdges()).toEqual([])
        next.close()
    })

    test("committed graph observations fail closed after the bounded edge capacity", () => {
        const domain = createCommittedStoreTreeDomain()
        let scope: StoreScopeNode | undefined
        const trace = ((code: number, _first?: unknown, second?: unknown) => {
            if (code === 0 && scope === undefined) {
                scope = second as StoreScopeNode
            }
        }) as InternalStoreTreeTrace
        const store = domain.createStoreTree(undefined, trace)
        const heads = Array.from({ length: 4_097 }, (_, index) =>
            domain.selector(() => index),
        )
        const tail = domain.selector(get => {
            let sum = 0
            for (const head of heads) sum += get(head)
            return sum
        })
        const observation = scope!.beginSelectorGraphObservation(heads[0]!)!

        expect(store.get(tail)).toBe((4_096 * 4_097) / 2)
        expect(observation.takeAddedEdges()).toBeUndefined()
        observation.close()

        const next = scope!.beginSelectorGraphObservation(heads[0]!)!
        expect(next.takeAddedEdges()).toEqual([])
        next.close()
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

    const buildShiftXHub = (cycleAt = -1) => {
        const width = 200
        const firstDepth = 100
        const secondDepth = 400
        const source = atom(0, { name: "source" })
        const close = atom(false, { name: "close" })
        const firstChain: ReturnType<typeof selector<number>>[] = []
        for (let index = firstDepth - 1; index >= 0; index--) {
            const next =
                index === firstDepth - 1 ? source : firstChain[index + 1]!
            firstChain[index] = selector(get => get(next) + 1, {
                name: `first/${index}`,
            })
        }
        const lineIds = selector(get => get(firstChain[0]!), {
            name: "lineIds",
        })
        const secondChain: ReturnType<typeof selector<number>>[] = []
        for (let index = secondDepth - 1; index >= 0; index--) {
            const next =
                index === secondDepth - 1
                    ? firstChain[firstDepth >> 1]!
                    : secondChain[index + 1]!
            secondChain[index] = selector(get => get(next) + 1, {
                name: `second/${index}`,
            })
        }
        let hub!: ReturnType<typeof selector<number>>
        const echo = selector(get => get(hub), { name: "echo" })
        const privates = Array.from({ length: width }, (_, index) =>
            index === cycleAt
                ? selector(
                      get => (get(close) ? get(echo) : get(source) + index),
                      { name: `private/${index}` },
                  )
                : selector(get => get(source) + index, {
                      name: `private/${index}`,
                  }),
        )
        const lines = privates.map((privateSelector, index) =>
            selector(get => get(privateSelector) + get(secondChain[0]!), {
                name: `line/${index}`,
            }),
        )
        hub = selector(
            get => {
                if (get(source) === 0) return 0
                let sum = get(lineIds)
                for (const line of lines) sum += get(line)
                return sum
            },
            { name: "hub" },
        )
        return {
            width,
            firstDepth,
            secondDepth,
            source,
            close,
            lineIds,
            echo,
            privates,
            lines,
            hub,
        }
    }

    const warmShiftXHub = (
        graph: ReturnType<typeof buildShiftXHub>,
        store: ReturnType<typeof createInspectableStore>["store"],
    ) => {
        expect(store.get(graph.hub)).toBe(0)
        expect(store.get(graph.echo)).toBe(0)
        store.get(graph.lineIds)
        for (const line of graph.lines) store.get(line)
    }

    const runWarmNarrowProofSequence = (
        proofs: readonly Readonly<{
            node: string
            chain?: string
            chainDepth?: number
            chainTail?: string
        }>[],
        depth = 64,
        measured = true,
    ) => {
        const host = new TestHost()
        host.setLeaf("leaf", 1)

        const chains = new Map<
            string,
            Readonly<{ depth: number; tail: string }>
        >()
        for (const proof of proofs) {
            if (proof.chain === undefined) continue
            chains.set(
                proof.chain,
                Object.freeze({
                    depth: proof.chainDepth ?? depth,
                    tail: proof.chainTail ?? "leaf",
                }),
            )
        }
        for (const [chain, config] of chains) {
            const chainDepth = config.depth
            for (let index = chainDepth - 1; index >= 0; index--) {
                host.define({
                    node: `${chain}-${index}`,
                    get: get =>
                        get(
                            index + 1 === chainDepth
                                ? config.tail
                                : `${chain}-${index + 1}`,
                        ),
                })
            }
            expect(valueOf(host.read<number>(`${chain}-0`))).toBe(1)
        }
        for (const proof of proofs) {
            host.define({
                node: proof.node,
                get: get => get(proof.chain ? `${proof.chain}-0` : "leaf"),
            })
            expect(valueOf(host.read<number>(proof.node))).toBe(1)
        }

        let expanded = false
        const parent: SelectorDefinition<Node, number> = {
            node: "parent",
            get: get => {
                let sum = get<number>("leaf")
                if (expanded) {
                    for (const proof of proofs) sum += get<number>(proof.node)
                }
                return sum
            },
        }
        host.define(parent)
        expect(valueOf(host.read<number>("parent"))).toBe(1)

        const setup = measured ? createInspectionRecorder() : undefined
        if (setup !== undefined) {
            const hostRef = setup.recorder.reference(host, "scope")
            host.cycleTrace = (
                start,
                target,
                cycleHost,
                session,
                site,
                acceptedPrefixLength,
                newEdgeProofMemo,
            ) =>
                setup.recorder.findDependencyPath(
                    "committed",
                    hostRef,
                    start,
                    target,
                    cycleHost,
                    session,
                    site,
                    acceptedPrefixLength,
                    cycleHost.getSelectorGraphVersion(),
                    session.getSelectorGraphPublicationCount(cycleHost),
                    false,
                    newEdgeProofMemo,
                )
        }

        const diagnostics = {
            admissionSkipped: 0,
            disabled: 0,
            graphVersionResets: 0,
            searches: [] as Readonly<{
                classification: string
                seed?: string
                disable?: string
                mapProbes: number
                prunedNodes: number
                retainedEntries: number
            }>[],
        }
        host.newEdgeProofDiagnostics = {
            admissionSkipped: () => diagnostics.admissionSkipped++,
            disabled: () => diagnostics.disabled++,
            graphVersionReset: () => diagnostics.graphVersionResets++,
            completeSearch: (
                classification,
                seed,
                disable,
                mapProbes = 0,
                prunedNodes = 0,
                retainedEntries = 0,
            ) =>
                diagnostics.searches.push({
                    classification,
                    ...(seed === undefined ? {} : { seed }),
                    ...(disable === undefined ? {} : { disable }),
                    mapProbes,
                    prunedNodes,
                    retainedEntries,
                }),
        }

        expanded = true
        host.markDirty("parent")
        host.selectorDependencyNodeReadNodes.length = 0
        expect(valueOf(host.read<number>("parent"))).toBe(1 + proofs.length)
        const searches =
            setup?.inspect
                .export()
                .details.filter(
                    (detail): detail is CycleSearchInspectionDetail =>
                        detail.type === "cycle-search" &&
                        detail.site === "new-edge-proof",
                ) ?? []
        return Object.freeze({
            searches,
            diagnostics,
            adjacencyReads: host.selectorDependencyNodeReadNodes.length,
        })
    }

    test("bounds ShiftX-shaped rewiring by changed topology rather than prefix width", () => {
        const graph = buildShiftXHub()
        const { store, inspect } = createInspectableStore({
            capacity: { summaries: 8_192, details: 250_000 },
        })
        warmShiftXHub(graph, store)
        inspect.reset()
        store.txn(transaction => transaction.set(graph.source, 1), "rewire")
        expect(store.get(graph.hub)).toBe(
            graph.firstDepth +
                1 +
                graph.width *
                    (graph.secondDepth +
                        graph.firstDepth -
                        (graph.firstDepth >> 1) +
                        1) +
                (graph.width * (graph.width - 1)) / 2 +
                graph.width,
        )

        const report = inspect.export()
        const operation = report.summaries.find(
            summary =>
                summary.type === "operation" && summary.name === "rewire",
        )!
        expect(report.complete).toBe(true)
        expect(operation.totals).toMatchObject({
            selectorEvaluations:
                2 * graph.width + graph.firstDepth + graph.secondDepth + 3,
            proposedTopologyChanges: 1,
            proposedTopologyIdentical: 902,
        })
        expect(operation.totals.cycle.found).toBe(0)
        expect(operation.totals.cycle.bySite).toEqual({
            prefixRevalidation: 0,
            newEdgeProof: 201,
            topologyDeltaProof: 0,
        })
        expect(operation.totals.cycle.byHost).toEqual({
            committed: 201,
            scratch: 0,
            hydration: 0,
        })
        expect(operation.totals.cycle.searches).toBe(201)
        // Each cold child publication advances the graph, but its exact edge
        // additions do not escape the retained negative closure. A2 carries
        // that proof across versions instead of restarting the shared walk.
        expect(operation.totals.cycle.visits).toBe(1_599)
        expect(operation.totals.cycle.maxVisits).toBe(452)
        expect(operation.totals.cycle.newEdgeProofMemo).toMatchObject({
            observing: 3,
            consultedPruned: 198,
            mapProbes: 396,
            prunedNodes: 198,
            resets: { graphVersion: 0 },
            seeds: {
                initial: 1,
                activationReplacement: 1,
                hitDerived: 198,
            },
            retained: { maxEntries: 455 },
        })
        const searches = report.details.filter(
            (detail): detail is CycleSearchInspectionDetail =>
                detail.type === "cycle-search",
        )
        expect(searches.filter(search => search.visits === 101)).toHaveLength(1)
        expect(searches.filter(search => search.visits === 452)).toHaveLength(2)
        expect(searches.filter(search => search.visits === 3)).toHaveLength(198)
    })

    test("passively learns proof one for a warm narrow large-terminal-terminal-large sequence", () => {
        const proofs = [
            { node: "shared-a", chain: "shared" },
            { node: "terminal-a" },
            { node: "terminal-b" },
            { node: "shared-b", chain: "shared" },
        ] as const
        const fast = runWarmNarrowProofSequence(proofs, 64, false)
        const { searches, diagnostics, adjacencyReads } =
            runWarmNarrowProofSequence(proofs)

        expect(searches.map(search => search.visits)).toEqual([65, 1, 1, 2])
        expect(fast.adjacencyReads).toBe(69)
        expect(adjacencyReads).toBe(fast.adjacencyReads)
        expect(diagnostics.searches).toEqual([
            {
                classification: "observing",
                seed: "initial",
                mapProbes: 0,
                prunedNodes: 0,
                retainedEntries: 65,
            },
            {
                classification: "observing",
                mapProbes: 0,
                prunedNodes: 0,
                retainedEntries: 65,
            },
            {
                classification: "observing",
                mapProbes: 0,
                prunedNodes: 0,
                retainedEntries: 65,
            },
            {
                classification: "consulted-pruned",
                seed: "hit-derived",
                mapProbes: 2,
                prunedNodes: 1,
                retainedEntries: 67,
            },
        ])
    })

    test("replaces a passive proof-one anchor with a substantial proof three", () => {
        const { searches, diagnostics } = runWarmNarrowProofSequence([
            { node: "a-root", chain: "a" },
            { node: "terminal" },
            { node: "b-root", chain: "b" },
            { node: "b-sibling", chain: "b" },
        ])

        expect(searches.map(search => search.visits)).toEqual([65, 1, 65, 2])
        expect(diagnostics.searches.map(search => search.seed)).toEqual([
            "initial",
            undefined,
            "activation-replacement",
            "hit-derived",
        ])
        expect(diagnostics.searches.map(search => search.mapProbes)).toEqual([
            0, 0, 0, 2,
        ])
    })

    test("classifies an active terminal proof as consulted without probing", () => {
        const host = new TestHost()
        for (const leaf of ["leaf-a", "leaf-b", "leaf-c"]) {
            host.setLeaf(leaf, 1)
        }
        for (let index = 31; index >= 0; index--) {
            host.define({
                node: `wide-${index}`,
                get: get => get(index === 31 ? "leaf-a" : `wide-${index + 1}`),
            })
        }
        expect(valueOf(host.read<number>("wide-0"))).toBe(1)
        host.define({ node: "wide-root", get: get => get("wide-0") })
        host.define({ node: "terminal", get: get => get("leaf-a") })
        expect(valueOf(host.read<number>("wide-root"))).toBe(1)
        expect(valueOf(host.read<number>("terminal"))).toBe(1)

        let expanded = false
        host.define({
            node: "parent",
            get: get => {
                let sum =
                    get<number>("leaf-a") +
                    get<number>("leaf-b") +
                    get<number>("leaf-c")
                if (expanded) {
                    sum += get<number>("wide-root")
                    sum += get<number>("terminal")
                }
                return sum
            },
        })
        expect(valueOf(host.read<number>("parent"))).toBe(3)
        const completed: Readonly<{
            classification: string
            mapProbes: number
        }>[] = []
        host.newEdgeProofDiagnostics = {
            admissionSkipped: () => {},
            disabled: () => {},
            graphVersionReset: () => {},
            completeSearch: (classification, _seed, _disable, mapProbes = 0) =>
                completed.push({ classification, mapProbes }),
        }
        expanded = true
        host.markDirty("parent")

        expect(valueOf(host.read<number>("parent"))).toBe(5)
        expect(completed).toEqual([
            { classification: "observing", mapProbes: 0 },
            { classification: "consulted-no-prune", mapProbes: 0 },
        ])
    })

    test("keeps warm-zero admission conservative and partitions every proof", () => {
        const host = new TestHost()
        host.setLeaf("leaf", 1)
        for (let index = 30; index >= 0; index--) {
            host.define({
                node: `large-${index}`,
                get: get => get(index === 30 ? "leaf" : `large-${index + 1}`),
            })
        }
        expect(valueOf(host.read<number>("large-0"))).toBe(1)
        for (const [node, dependency] of [
            ["terminal-a", "leaf"],
            ["terminal-b", "leaf"],
            ["large-root", "large-0"],
        ] as const) {
            host.define({ node, get: get => get(dependency) })
            expect(valueOf(host.read<number>(node))).toBe(1)
        }

        let expanded = false
        host.define({
            node: "parent",
            get: get => {
                if (!expanded) return 0
                return (
                    get<number>("terminal-a") +
                    get<number>("terminal-b") +
                    get<number>("large-root")
                )
            },
        })
        expect(valueOf(host.read<number>("parent"))).toBe(0)

        const setup = createInspectionRecorder()
        const hostRef = setup.recorder.reference(host, "scope")
        host.cycleTrace = (
            start,
            target,
            cycleHost,
            session,
            site,
            acceptedPrefixLength,
            newEdgeProofMemo,
        ) =>
            setup.recorder.findDependencyPath(
                "committed",
                hostRef,
                start,
                target,
                cycleHost,
                session,
                site,
                acceptedPrefixLength,
                cycleHost.getSelectorGraphVersion(),
                session.getSelectorGraphPublicationCount(cycleHost),
                false,
                newEdgeProofMemo,
            )
        const diagnostics = {
            admissionSkipped: 0,
            disabled: 0,
            searches: 0,
        }
        host.newEdgeProofDiagnostics = {
            admissionSkipped: () => diagnostics.admissionSkipped++,
            disabled: () => diagnostics.disabled++,
            graphVersionReset: () => {},
            completeSearch: () => diagnostics.searches++,
        }
        expanded = true
        host.markDirty("parent")

        expect(valueOf(host.read<number>("parent"))).toBe(3)
        const siteOneSearches = setup.inspect
            .export()
            .details.filter(
                (detail): detail is CycleSearchInspectionDetail =>
                    detail.type === "cycle-search" &&
                    detail.site === "new-edge-proof",
            )
        expect(siteOneSearches).toHaveLength(3)
        expect(diagnostics).toEqual({
            admissionSkipped: 2,
            disabled: 0,
            searches: 1,
        })
        expect(
            diagnostics.admissionSkipped +
                diagnostics.disabled +
                diagnostics.searches,
        ).toBe(siteOneSearches.length)
    })

    test("bounds passive misses cumulatively across a short miss and a huge disjoint proof", () => {
        const proofs = [
            { node: "shared-root", chain: "shared", chainDepth: 64 },
            { node: "terminal-a" },
            { node: "terminal-b" },
            { node: "short-root", chain: "short", chainDepth: 10 },
            { node: "disjoint-root", chain: "disjoint", chainDepth: 256 },
            { node: "after-disable" },
        ] as const
        const fast = runWarmNarrowProofSequence(proofs, 64, false)
        const { searches, diagnostics, adjacencyReads } =
            runWarmNarrowProofSequence(proofs)

        expect(searches.map(search => search.visits)).toEqual([
            65, 1, 1, 11, 257, 1,
        ])
        expect(diagnostics.searches.map(search => search.mapProbes)).toEqual([
            0, 0, 0, 10, 120,
        ])
        expect(diagnostics.searches.at(-1)).toMatchObject({
            classification: "consulted-no-prune",
            disable: "passive-probe-budget",
            mapProbes: 120,
            prunedNodes: 0,
            retainedEntries: 0,
        })
        expect(diagnostics.disabled).toBe(1)
        expect(
            diagnostics.admissionSkipped +
                diagnostics.disabled +
                diagnostics.searches.length,
        ).toBe(searches.length)
        expect(adjacencyReads).toBe(fast.adjacencyReads)
    })

    test("allows a passive-anchor hit on the final probe in its budget", () => {
        const { searches, diagnostics } = runWarmNarrowProofSequence([
            { node: "shared-root", chain: "shared", chainDepth: 31 },
            { node: "terminal-a" },
            { node: "terminal-b" },
            {
                node: "approach-root",
                chain: "approach",
                chainDepth: 62,
                chainTail: "shared-0",
            },
        ])

        expect(searches.map(search => search.visits)).toEqual([32, 1, 1, 64])
        expect(diagnostics.searches.at(-1)).toMatchObject({
            classification: "consulted-pruned",
            mapProbes: 64,
            prunedNodes: 1,
        })
        expect(diagnostics.searches.at(-1)?.disable).toBeUndefined()
    })

    test("keeps a warm narrow positive path canonical after passive learning", () => {
        const run = (measured: boolean) => {
            const host = new TestHost()
            host.setLeaf("leaf", 1)
            for (let index = 39; index >= 0; index--) {
                host.define({
                    node: `shared-${index}`,
                    get: get =>
                        get(index === 39 ? "leaf" : `shared-${index + 1}`),
                })
            }
            expect(valueOf(host.read<number>("shared-0"))).toBe(1)
            for (const [node, dependency] of [
                ["large", "shared-0"],
                ["terminal-a", "leaf"],
                ["terminal-b", "leaf"],
            ] as const) {
                host.define({ node, get: get => get(dependency) })
                expect(valueOf(host.read<number>(node))).toBe(1)
            }

            let expanded = false
            const parent: SelectorDefinition<Node, number> = {
                node: "parent",
                get: get => {
                    get("leaf")
                    if (expanded) {
                        get("large")
                        get("terminal-a")
                        get("terminal-b")
                        get("cycle-start")
                    }
                    return 1
                },
            }
            host.define(parent)
            expect(valueOf(host.read<number>("parent"))).toBe(1)
            host.define({ node: "bridge", get: get => get("parent") })
            expect(valueOf(host.read<number>("bridge"))).toBe(1)
            host.define({ node: "cycle-start", get: get => get("bridge") })
            expect(valueOf(host.read<number>("cycle-start"))).toBe(1)

            const setup = measured ? createInspectionRecorder() : undefined
            if (setup !== undefined) {
                const hostRef = setup.recorder.reference(host, "scope")
                host.cycleTrace = (
                    start,
                    target,
                    cycleHost,
                    session,
                    site,
                    acceptedPrefixLength,
                    newEdgeProofMemo,
                ) =>
                    setup.recorder.findDependencyPath(
                        "committed",
                        hostRef,
                        start,
                        target,
                        cycleHost,
                        session,
                        site,
                        acceptedPrefixLength,
                        cycleHost.getSelectorGraphVersion(),
                        session.getSelectorGraphPublicationCount(cycleHost),
                        false,
                        newEdgeProofMemo,
                    )
            }
            expanded = true
            host.markDirty("parent")
            host.selectorDependencyNodeReadNodes.length = 0
            const error = normalizeCycleParityError(
                errorOf(host.read("parent")),
            )
            const positive = setup?.inspect
                .export()
                .details.find(
                    (detail): detail is CycleSearchInspectionDetail =>
                        detail.type === "cycle-search" && detail.found,
                )
            return Object.freeze({
                error,
                positive,
                adjacencyReads: host.selectorDependencyNodeReadNodes.length,
            })
        }

        const fast = run(false)
        const measured = run(true)
        expect(measured.error).toEqual(fast.error)
        expect(measured.adjacencyReads).toBe(fast.adjacencyReads)
        expect(measured.error).toEqual({
            name: "SelectorCircularDependencyError",
            selector: "parent",
            path: ["parent", "cycle-start", "bridge", "parent"],
        })
        expect(measured.positive).toMatchObject({
            site: "new-edge-proof",
            start: "cycle-start",
            target: "parent",
            path: ["cycle-start", "bridge", "parent"],
        })
    })
    test("shares fully negative warm re-proofs at one exact graph version", () => {
        const width = 200
        const depth = 400
        const run = (mode: "baseline" | "fast" | "measured") => {
            const host = new TestHost()
            host.setLeaf("tail", 1)
            host.setLeaf("trigger-leaf", 1)
            for (let index = depth - 1; index >= 0; index--) {
                host.define({
                    node: `shared-${index}`,
                    get: get =>
                        get(
                            index + 1 === depth
                                ? "tail"
                                : `shared-${index + 1}`,
                        ),
                })
            }
            expect(valueOf(host.read<number>("shared-0"))).toBe(1)
            host.define({ node: "small-seed", get: get => get("shared-350") })
            expect(valueOf(host.read<number>("small-seed"))).toBe(1)
            const roots = Array.from(
                { length: width },
                (_, index) => `root-${index}`,
            )
            for (const root of roots) {
                host.define({ node: root, get: get => get("shared-0") })
                expect(valueOf(host.read<number>(root))).toBe(1)
            }
            const trigger: SelectorDefinition<Node, number> = {
                node: "trigger",
                get: get => get("trigger-leaf"),
            }
            const parent: SelectorDefinition<Node, number> = {
                node: "parent",
                get: get => {
                    let sum = get<number>("trigger")
                    sum += get<number>("small-seed")
                    for (const root of roots) sum += get<number>(root)
                    return sum
                },
            }
            host.define(trigger)
            host.define(parent)
            expect(valueOf(host.read<number>("parent"))).toBe(width + 2)

            const setup =
                mode === "fast" ? undefined : createInspectionRecorder()
            if (setup !== undefined) {
                const hostRef = setup.recorder.reference(host, "scope")
                host.cycleTrace = (
                    start,
                    target,
                    cycleHost,
                    session,
                    site,
                    acceptedPrefixLength,
                    newEdgeProofMemo,
                ) =>
                    setup.recorder.findDependencyPath(
                        "committed",
                        hostRef,
                        start,
                        target,
                        cycleHost,
                        session,
                        site,
                        acceptedPrefixLength,
                        cycleHost.getSelectorGraphVersion(),
                        session.getSelectorGraphPublicationCount(cycleHost),
                        false,
                        mode === "measured" ? newEdgeProofMemo : undefined,
                    )
            }
            host.define(trigger)
            host.markDirty("parent")
            host.selectorDependencyNodeReadNodes.length = 0

            const served = host.read<number>("parent")
            const searches =
                setup?.inspect
                    .export()
                    .details.filter(
                        (detail): detail is CycleSearchInspectionDetail =>
                            detail.type === "cycle-search" &&
                            detail.site === "new-edge-proof",
                    ) ?? []
            return Object.freeze({
                value: valueOf(served),
                dependencies: host.records
                    .get("parent")!
                    .dependencies.map(dependency => dependency.node),
                adjacencyReads: host.selectorDependencyNodeReadNodes.length,
                searches,
                visits: searches.reduce(
                    (total, search) => total + search.visits,
                    0,
                ),
            })
        }

        const baseline = run("baseline")
        const fast = run("fast")
        const measured = run("measured")

        expect(baseline.visits).toBe(80_252)
        expect(fast.value).toBe(width + 2)
        expect(measured.value).toBe(fast.value)
        expect(measured.dependencies).toEqual(fast.dependencies)
        // The 51-node seed is hit only after the next root walks a much larger
        // approach closure. Keeping both layers is the beta.29 falsifier: an
        // implementation that retains only the hit seed repeatedly walks the
        // 350-node approach for every sibling root.
        expect(fast.adjacencyReads).toBe(802)
        expect(measured.adjacencyReads).toBe(fast.adjacencyReads)
        expect(measured.searches).toHaveLength(width + 2)
        expect(measured.visits).toBe(fast.adjacencyReads)
    })

    test("keeps a positive site-1 path canonical after cached negative pruning", () => {
        const run = (inspected: boolean) => {
            const host = new TestHost()
            const depth = 40
            host.setLeaf("tail", 1)
            host.setLeaf("kick-leaf", 1)
            for (let index = depth - 1; index >= 0; index--) {
                host.define({
                    node: `shared-${index}`,
                    get: get =>
                        get(
                            index + 1 === depth
                                ? "tail"
                                : `shared-${index + 1}`,
                        ),
                })
            }
            expect(valueOf(host.read<number>("shared-0"))).toBe(1)
            for (const root of ["root-1", "root-2", "root-3"]) {
                host.define({ node: root, get: get => get("shared-0") })
                expect(valueOf(host.read<number>(root))).toBe(1)
            }
            const kick: SelectorDefinition<Node, number> = {
                node: "kick",
                get: get => get("kick-leaf"),
            }
            host.define(kick)
            let includeCycleStart = false
            const parent: SelectorDefinition<Node, number> = {
                node: "parent",
                get: get => {
                    get("kick")
                    get("root-1")
                    get("root-2")
                    get("root-3")
                    if (includeCycleStart) get("cycle-start")
                    return 1
                },
            }
            host.define(parent)
            expect(valueOf(host.read<number>("parent"))).toBe(1)
            host.define({ node: "bridge", get: get => get("parent") })
            host.define({
                node: "cycle-start",
                get: get => {
                    get("bridge")
                    get("shared-0")
                    return 1
                },
            })
            expect(valueOf(host.read<number>("cycle-start"))).toBe(1)

            const setup = inspected ? createInspectionRecorder() : undefined
            if (setup !== undefined) {
                const hostRef = setup.recorder.reference(host, "scope")
                host.cycleTrace = (
                    start,
                    target,
                    cycleHost,
                    session,
                    site,
                    acceptedPrefixLength,
                    newEdgeProofMemo,
                ) =>
                    setup.recorder.findDependencyPath(
                        "committed",
                        hostRef,
                        start,
                        target,
                        cycleHost,
                        session,
                        site,
                        acceptedPrefixLength,
                        cycleHost.getSelectorGraphVersion(),
                        session.getSelectorGraphPublicationCount(cycleHost),
                        false,
                        newEdgeProofMemo,
                    )
            }
            includeCycleStart = true
            host.define(kick)
            host.markDirty("parent")
            const error = errorOf(host.read("parent"))
            const positives =
                setup?.inspect
                    .export()
                    .details.filter(
                        (detail): detail is CycleSearchInspectionDetail =>
                            detail.type === "cycle-search" && detail.found,
                    ) ?? []
            return Object.freeze({
                error: normalizeCycleParityError(error),
                dependencies: host.records
                    .get("parent")!
                    .dependencies.map(dependency => dependency.node),
                positives,
            })
        }

        const fast = run(false)
        const measured = run(true)

        expect(measured.error).toEqual(fast.error)
        expect(measured.dependencies).toEqual(fast.dependencies)
        expect(measured.error).toMatchObject({
            name: "SelectorCircularDependencyError",
            selector: "parent",
            path: ["parent", "cycle-start", "bridge", "parent"],
        })
        expect(measured.dependencies).toEqual([
            "kick",
            "root-1",
            "root-2",
            "root-3",
        ])
        expect(measured.positives).toEqual([
            expect.objectContaining({
                site: "new-edge-proof",
                start: "cycle-start",
                target: "parent",
                path: ["cycle-start", "bridge", "parent"],
                visits: 4,
            }),
        ])
    })

    test("carries one independently closed anchor across an exact safe graph addition", () => {
        const run = (
            inspected: boolean,
            mutation: "outside" | "inside",
            maxObservedEdges = 4_096,
            publicationSession: "foreign" | "same" = "foreign",
            outsideAdditions = 1,
        ) => {
            const host = new TestHost("persistent-pre", {
                maxObservedEdges,
            })
            const depth = 40
            host.setLeaf("leaf", 1)
            for (let index = depth - 1; index >= 0; index--) {
                host.define({
                    node: `shared-${index}`,
                    get: get =>
                        get(
                            index + 1 === depth
                                ? "leaf"
                                : `shared-${index + 1}`,
                        ),
                })
            }
            expect(valueOf(host.read<number>("shared-0"))).toBe(1)
            for (const root of ["root-1", "root-2"]) {
                host.define({ node: root, get: get => get("shared-0") })
                expect(valueOf(host.read<number>(root))).toBe(1)
            }
            for (const terminal of ["warm-a", "warm-b", "trigger"]) {
                host.define({ node: terminal, get: get => get("leaf") })
                expect(valueOf(host.read<number>(terminal))).toBe(1)
            }
            const unrelated = Array.from(
                { length: outsideAdditions },
                (_, index) =>
                    Object.freeze({
                        tail: `unrelated-${index}`,
                        head: `unrelated-child-${index}`,
                    }),
            )
            for (const edge of unrelated) {
                host.define({ node: edge.head, get: get => get("leaf") })
                expect(valueOf(host.read<number>(edge.head))).toBe(1)
                host.define({ node: edge.tail, get: get => get("leaf") })
                expect(valueOf(host.read<number>(edge.tail))).toBe(1)
            }

            host.define({
                node: "parent",
                get: get => {
                    get("warm-a")
                    get("warm-b")
                    get("trigger")
                    return 1
                },
            })
            expect(valueOf(host.read<number>("parent"))).toBe(1)

            const setup = inspected ? createInspectionRecorder() : undefined
            if (setup !== undefined) {
                const hostRef = setup.recorder.reference(host, "scope")
                host.cycleTrace = (
                    start,
                    target,
                    cycleHost,
                    session,
                    site,
                    acceptedPrefixLength,
                    newEdgeProofMemo,
                ) =>
                    setup.recorder.findDependencyPath(
                        "committed",
                        hostRef,
                        start,
                        target,
                        cycleHost,
                        session,
                        site,
                        acceptedPrefixLength,
                        cycleHost.getSelectorGraphVersion(),
                        session.getSelectorGraphPublicationCount(cycleHost),
                        false,
                        newEdgeProofMemo,
                    )
            }
            let graphVersionResets = 0
            let mapProbes = 0
            host.newEdgeProofDiagnostics = {
                admissionSkipped: () => {},
                disabled: () => {},
                graphVersionReset: () => graphVersionResets++,
                recordMapProbes: count => (mapProbes += count),
                completeSearch: (
                    _classification,
                    _seed,
                    _disable,
                    searchMapProbes = 0,
                ) => (mapProbes += searchMapProbes),
            }
            let published = false
            host.setServeEffect("trigger", session => {
                if (published) return
                published = true
                if (mutation === "outside") {
                    for (const edge of unrelated) {
                        host.define({
                            node: edge.tail,
                            get: get => get(edge.head),
                        })
                        const served =
                            publicationSession === "same"
                                ? host.serve(edge.tail, session)
                                : host.read<number>(edge.tail)
                        expect(valueOf(served)).toBe(1)
                    }
                } else {
                    host.define({
                        node: "shared-0",
                        get: get =>
                            get<number>("shared-1") + get<number>("shared-2"),
                    })
                    expect(valueOf(host.read<number>("shared-0"))).toBe(2)
                }
            })
            host.define({
                node: "parent",
                get: get => {
                    get("root-1")
                    get("trigger")
                    get("root-2")
                    return 1
                },
            })
            host.graphObservationTakes = 0

            const served = host.read<number>("parent")
            const details = setup?.inspect.export().details ?? []
            const searches = details.filter(
                (detail): detail is CycleSearchInspectionDetail =>
                    detail.type === "cycle-search" &&
                    detail.site === "new-edge-proof" &&
                    detail.target === "parent",
            )
            return Object.freeze({
                value: valueOf(served),
                dependencies: host.records
                    .get("parent")!
                    .dependencies.map(dependency => dependency.node),
                graphVersionResets,
                graphObservationTakes: host.graphObservationTakes,
                mapProbes,
                searches,
                topologyDeltaSearches: details.filter(
                    detail =>
                        detail.type === "cycle-search" &&
                        detail.site === "topology-delta-proof",
                ).length,
            })
        }

        const fast = run(false, "outside")
        const measured = run(true, "outside")

        expect(measured.value).toBe(fast.value)
        expect(measured.dependencies).toEqual(fast.dependencies)
        expect(measured.dependencies).toEqual(["root-1", "trigger", "root-2"])
        expect(fast.graphVersionResets).toBe(0)
        expect(measured.graphVersionResets).toBe(0)
        expect(fast.graphObservationTakes).toBe(1)
        expect(measured.graphObservationTakes).toBe(1)
        expect(measured.searches.map(search => search.visits)).toEqual([
            41, 1, 2,
        ])
        expect(measured.topologyDeltaSearches).toBe(1)
        // One exact-delta tail check plus the root/shared cache hit.
        expect(measured.mapProbes).toBe(3)

        const sameSessionFast = run(false, "outside", 4_096, "same")
        const sameSessionMeasured = run(true, "outside", 4_096, "same")
        expect(sameSessionMeasured.value).toBe(sameSessionFast.value)
        expect(sameSessionMeasured.dependencies).toEqual(
            sameSessionFast.dependencies,
        )
        expect(sameSessionMeasured.graphVersionResets).toBe(0)
        expect(sameSessionMeasured.graphObservationTakes).toBe(1)
        expect(
            sameSessionMeasured.searches.map(search => search.visits),
        ).toEqual([41, 1, 2])
        expect(sameSessionMeasured.topologyDeltaSearches).toBe(0)
        expect(sameSessionMeasured.mapProbes).toBe(3)

        const internalFast = run(false, "inside")
        const internalMeasured = run(true, "inside")
        expect(internalMeasured.value).toBe(internalFast.value)
        expect(internalMeasured.dependencies).toEqual(internalFast.dependencies)
        expect(internalMeasured.graphVersionResets).toBe(0)
        expect(internalMeasured.graphObservationTakes).toBe(1)
        expect(internalMeasured.searches.map(search => search.visits)).toEqual([
            41, 1, 2,
        ])
        // An internal addition checks both its tail and head before the hit.
        expect(internalMeasured.mapProbes).toBe(4)

        const incompleteFast = run(false, "outside", 0)
        const incompleteMeasured = run(true, "outside", 0)
        expect(incompleteMeasured.value).toBe(incompleteFast.value)
        expect(incompleteMeasured.dependencies).toEqual(
            incompleteFast.dependencies,
        )
        expect(incompleteMeasured.graphVersionResets).toBe(1)
        expect(incompleteMeasured.graphObservationTakes).toBe(1)
        expect(
            incompleteMeasured.searches.map(search => search.visits),
        ).toEqual([41, 1, 41])
        expect(incompleteMeasured.mapProbes).toBe(0)

        const exhaustedFast = run(false, "outside", 4_096, "foreign", 82)
        const exhaustedMeasured = run(true, "outside", 4_096, "foreign", 82)
        expect(exhaustedMeasured.value).toBe(exhaustedFast.value)
        expect(exhaustedMeasured.dependencies).toEqual(
            exhaustedFast.dependencies,
        )
        expect(exhaustedMeasured.graphVersionResets).toBe(1)
        expect(exhaustedMeasured.searches.map(search => search.visits)).toEqual(
            [41, 1, 41],
        )
        // Validation stops after twice the 41-entry anchor rather than
        // inheriting the observer's much larger 4,096-edge capacity.
        expect(exhaustedMeasured.mapProbes).toBe(82)
    })

    test("keeps cross-version validation inside one cumulative probe budget", () => {
        const run = (inspected: boolean) => {
            const host = new TestHost()
            host.setLeaf("leaf", 1)
            for (let index = 30; index >= 0; index--) {
                host.define({
                    node: `shared-${index}`,
                    get: get =>
                        get(index === 30 ? "leaf" : `shared-${index + 1}`),
                })
            }
            expect(valueOf(host.read<number>("shared-0"))).toBe(1)
            for (const root of ["root-1", "root-2"]) {
                host.define({ node: root, get: get => get("shared-0") })
                expect(valueOf(host.read<number>(root))).toBe(1)
            }
            for (const terminal of [
                "warm-a",
                "warm-b",
                "terminal-c",
                "trigger-a",
                "trigger-b",
            ]) {
                host.define({ node: terminal, get: get => get("leaf") })
                expect(valueOf(host.read<number>(terminal))).toBe(1)
            }
            const additions = Array.from({ length: 65 }, (_, index) =>
                Object.freeze({
                    tail: `change-${index}`,
                    head: `change-child-${index}`,
                }),
            )
            for (const edge of additions) {
                host.define({ node: edge.head, get: get => get("leaf") })
                expect(valueOf(host.read<number>(edge.head))).toBe(1)
                host.define({ node: edge.tail, get: get => get("leaf") })
                expect(valueOf(host.read<number>(edge.tail))).toBe(1)
            }
            host.define({
                node: "parent",
                get: get => get("warm-a"),
            })
            expect(valueOf(host.read<number>("parent"))).toBe(1)

            const setup = inspected ? createInspectionRecorder() : undefined
            if (setup !== undefined) {
                const hostRef = setup.recorder.reference(host, "scope")
                host.cycleTrace = (
                    start,
                    target,
                    cycleHost,
                    session,
                    site,
                    acceptedPrefixLength,
                    newEdgeProofMemo,
                ) =>
                    setup.recorder.findDependencyPath(
                        "committed",
                        hostRef,
                        start,
                        target,
                        cycleHost,
                        session,
                        site,
                        acceptedPrefixLength,
                        cycleHost.getSelectorGraphVersion(),
                        session.getSelectorGraphPublicationCount(cycleHost),
                        false,
                        newEdgeProofMemo,
                    )
            }
            let graphVersionResets = 0
            let mapProbes = 0
            host.newEdgeProofDiagnostics = {
                admissionSkipped: () => {},
                disabled: () => {},
                graphVersionReset: () => graphVersionResets++,
                recordMapProbes: count => (mapProbes += count),
                completeSearch: (
                    _classification,
                    _seed,
                    _disable,
                    searchMapProbes = 0,
                ) => (mapProbes += searchMapProbes),
            }
            let publishedA = false
            let publishedB = false
            const publish = (
                edges: readonly Readonly<{ tail: string; head: string }>[],
                session: SelectorEvaluationSession<Node>,
            ): void => {
                for (const edge of edges) {
                    host.define({ node: edge.tail, get: get => get(edge.head) })
                    expect(valueOf(host.serve(edge.tail, session))).toBe(1)
                }
            }
            host.setServeEffect("trigger-a", session => {
                if (publishedA) return
                publishedA = true
                publish(additions.slice(0, 32), session)
            })
            host.setServeEffect("trigger-b", session => {
                if (publishedB) return
                publishedB = true
                publish(additions.slice(32), session)
            })
            host.define({
                node: "parent",
                get: get => {
                    get("root-1")
                    get("warm-b")
                    get("terminal-c")
                    get("trigger-a")
                    get("trigger-b")
                    get("root-2")
                    return 1
                },
            })
            host.graphObservationTakes = 0

            const served = host.read<number>("parent")
            const searches =
                setup?.inspect
                    .export()
                    .details.filter(
                        (detail): detail is CycleSearchInspectionDetail =>
                            detail.type === "cycle-search" &&
                            detail.site === "new-edge-proof" &&
                            detail.target === "parent",
                    ) ?? []
            return Object.freeze({
                value: valueOf(served),
                graphVersionResets,
                graphObservationTakes: host.graphObservationTakes,
                mapProbes,
                searches,
            })
        }

        const fast = run(false)
        const measured = run(true)

        expect(measured.value).toBe(fast.value)
        expect(measured.graphVersionResets).toBe(1)
        expect(measured.graphObservationTakes).toBe(2)
        expect(measured.searches.map(search => search.visits)).toEqual([
            32, 1, 1, 1, 1, 32,
        ])
        // The first transition occurs exactly between passive proof three and
        // active proof four. The 32-entry anchor grants 64 checks total;
        // neither beginSearch nor the second transition may replenish them,
        // and probe 65 is never attempted.
        expect(measured.mapProbes).toBe(64)
    })

    test("carries the broader independently closed second anchor", () => {
        const host = new TestHost()
        host.setLeaf("leaf", 1)
        for (const node of [
            "warm-a",
            "warm-b",
            "trigger",
            "root-a",
            "root-b",
            "root-c",
            "unrelated",
        ]) {
            host.define({ node, get: get => get("leaf") })
            expect(valueOf(host.read<number>(node))).toBe(1)
        }
        host.define({
            node: "parent",
            get: get => {
                get("warm-a")
                get("warm-b")
                get("trigger")
                return 1
            },
        })
        expect(valueOf(host.read<number>("parent"))).toBe(1)

        const makeClosure = (
            prefix: string,
            size: number,
        ): ReadonlyMap<Node, unknown> => {
            const closure = new Map<Node, unknown>()
            for (let index = 0; index < size; index++) {
                closure.set(`${prefix}-${index}`, undefined)
            }
            return closure
        }
        const closures = [
            makeClosure("small", 32),
            makeClosure("large", 64),
            new Map<Node, unknown>([["trigger", undefined]]),
            new Map<Node, unknown>([["root-c", undefined]]),
        ]
        let parentProof = 0
        host.cycleTrace = (
            _start,
            target,
            _cycleHost,
            _session,
            site,
            _acceptedPrefixLength,
            newEdgeProofMemo,
        ) => {
            if (site !== 1 || target !== "parent") return undefined
            expect(newEdgeProofMemo).toBeDefined()
            const consult = newEdgeProofMemo!.beginSearch()
            if (parentProof === 0) expect(consult).toBe(false)
            else expect(consult).toBe(true)
            if (parentProof === 3) {
                expect(newEdgeProofMemo!.hasProvenNoPath("large-0")).toBe(true)
                expect(newEdgeProofMemo!.hasProvenNoPath("small-0")).toBe(false)
            }
            newEdgeProofMemo!.completeNegative(closures[parentProof]!)
            parentProof++
            return undefined
        }
        let published = false
        host.setServeEffect("trigger", () => {
            if (published) return
            published = true
            // A topology-identical publication produces a complete empty
            // interval, which is sufficient to carry the broader closure.
            host.define({ node: "unrelated", get: get => get("leaf") })
            expect(valueOf(host.read<number>("unrelated"))).toBe(1)
        })
        let graphVersionResets = 0
        host.newEdgeProofDiagnostics = {
            admissionSkipped: () => {},
            disabled: () => {},
            graphVersionReset: () => graphVersionResets++,
            completeSearch: () => {},
        }
        host.define({
            node: "parent",
            get: get => {
                get("root-a")
                get("root-b")
                get("trigger")
                get("root-c")
                return 1
            },
        })

        expect(valueOf(host.read<number>("parent"))).toBe(1)
        expect(parentProof).toBe(4)
        expect(graphVersionResets).toBe(0)
        expect(host.graphObservationTakes).toBe(1)
    })

    test("invalidates a warm negative anchor when an added edge escapes it", () => {
        const run = (inspected: boolean) => {
            const host = new TestHost()
            const depth = 40
            host.setLeaf("leaf", 1)
            host.setLeaf("trigger", 1)
            for (let index = depth - 1; index >= 0; index--) {
                host.define({
                    node: `shared-${index}`,
                    get: get =>
                        get(
                            index + 1 === depth
                                ? "leaf"
                                : `shared-${index + 1}`,
                        ),
                })
            }
            expect(valueOf(host.read<number>("shared-0"))).toBe(1)
            for (const root of ["root-1", "root-2", "root-3"]) {
                host.define({ node: root, get: get => get("shared-0") })
                expect(valueOf(host.read<number>(root))).toBe(1)
            }
            const kick: SelectorDefinition<Node, number> = {
                node: "kick",
                get: get => get("leaf"),
            }
            host.define(kick)
            let includeRoot3 = false
            const parent: SelectorDefinition<Node, number> = {
                node: "parent",
                get: get => {
                    get("kick")
                    get("root-1")
                    get("root-2")
                    get("trigger")
                    if (includeRoot3) get("root-3")
                    return 1
                },
            }
            host.define(parent)
            expect(valueOf(host.read<number>("parent"))).toBe(1)
            host.define({ node: "back", get: get => get("parent") })
            expect(valueOf(host.read<number>("back"))).toBe(1)

            const setup = inspected ? createInspectionRecorder() : undefined
            if (setup !== undefined) {
                const hostRef = setup.recorder.reference(host, "scope")
                host.cycleTrace = (
                    start,
                    target,
                    cycleHost,
                    session,
                    site,
                    acceptedPrefixLength,
                    newEdgeProofMemo,
                ) =>
                    setup.recorder.findDependencyPath(
                        "committed",
                        hostRef,
                        start,
                        target,
                        cycleHost,
                        session,
                        site,
                        acceptedPrefixLength,
                        cycleHost.getSelectorGraphVersion(),
                        session.getSelectorGraphPublicationCount(cycleHost),
                        false,
                        newEdgeProofMemo,
                    )
            }
            let graphVersionResets = 0
            host.newEdgeProofDiagnostics = {
                admissionSkipped: () => {},
                disabled: () => {},
                graphVersionReset: () => graphVersionResets++,
                completeSearch: () => {},
            }
            let rewired = false
            host.setServeEffect("trigger", () => {
                if (rewired) return
                rewired = true
                host.define({ node: "root-1", get: get => get("leaf") })
                host.define({ node: "root-2", get: get => get("leaf") })
                host.define({ node: "shared-0", get: get => get("back") })
                expect(valueOf(host.read<number>("root-1"))).toBe(1)
                expect(valueOf(host.read<number>("root-2"))).toBe(1)
                expect(valueOf(host.read<number>("shared-0"))).toBe(1)
            })
            includeRoot3 = true
            host.define(kick)
            host.markDirty("parent")

            const error = errorOf(host.read("parent"))
            const positives =
                setup?.inspect
                    .export()
                    .details.filter(
                        (detail): detail is CycleSearchInspectionDetail =>
                            detail.type === "cycle-search" && detail.found,
                    ) ?? []
            return Object.freeze({
                error: normalizeCycleParityError(error),
                dependencies: host.records
                    .get("parent")!
                    .dependencies.map(dependency => dependency.node),
                positives,
                graphVersionResets,
            })
        }

        const fast = run(false)
        const measured = run(true)

        expect(measured.error).toEqual(fast.error)
        expect(measured.dependencies).toEqual(fast.dependencies)
        expect(fast.graphVersionResets).toBe(1)
        expect(measured.graphVersionResets).toBe(fast.graphVersionResets)
        expect(measured.error).toMatchObject({
            name: "SelectorCircularDependencyError",
            selector: "parent",
            path: ["parent", "root-3", "shared-0", "back", "parent"],
        })
        expect(measured.dependencies).toEqual([
            "kick",
            "root-1",
            "root-2",
            "trigger",
        ])
        expect(measured.positives).toEqual([
            expect.objectContaining({
                site: "new-edge-proof",
                start: "root-3",
                target: "parent",
                path: ["root-3", "shared-0", "back", "parent"],
            }),
        ])
    })

    test("never carries hit-derived approach maps without a closed anchor", () => {
        const run = (inspected: boolean) => {
            const host = new TestHost()
            host.setLeaf("leaf", 1)
            const defineChain = (
                prefix: string,
                depth: number,
                tail: string,
            ): void => {
                for (let index = depth - 1; index >= 0; index--) {
                    host.define({
                        node: `${prefix}-${index}`,
                        get: get =>
                            get(
                                index + 1 === depth
                                    ? tail
                                    : `${prefix}-${index + 1}`,
                            ),
                    })
                }
                expect(valueOf(host.read<number>(`${prefix}-0`))).toBe(1)
            }
            defineChain("seed", 32, "leaf")
            defineChain("approach-a", 40, "seed-0")
            defineChain("approach-b", 50, "approach-a-0")
            host.define({ node: "approach-c", get: get => get("approach-b-0") })
            expect(valueOf(host.read<number>("approach-c"))).toBe(1)

            for (const terminal of [
                "warm-a",
                "warm-b",
                "trigger",
                "unrelated-child",
            ]) {
                host.define({ node: terminal, get: get => get("leaf") })
                expect(valueOf(host.read<number>(terminal))).toBe(1)
            }
            host.define({ node: "unrelated", get: get => get("leaf") })
            expect(valueOf(host.read<number>("unrelated"))).toBe(1)
            host.define({
                node: "parent",
                get: get => {
                    get("warm-a")
                    get("warm-b")
                    get("trigger")
                    return 1
                },
            })
            expect(valueOf(host.read<number>("parent"))).toBe(1)

            const setup = inspected ? createInspectionRecorder() : undefined
            if (setup !== undefined) {
                const hostRef = setup.recorder.reference(host, "scope")
                host.cycleTrace = (
                    start,
                    target,
                    cycleHost,
                    session,
                    site,
                    acceptedPrefixLength,
                    newEdgeProofMemo,
                ) =>
                    setup.recorder.findDependencyPath(
                        "committed",
                        hostRef,
                        start,
                        target,
                        cycleHost,
                        session,
                        site,
                        acceptedPrefixLength,
                        cycleHost.getSelectorGraphVersion(),
                        session.getSelectorGraphPublicationCount(cycleHost),
                        false,
                        newEdgeProofMemo,
                    )
            }
            let graphVersionResets = 0
            host.newEdgeProofDiagnostics = {
                admissionSkipped: () => {},
                disabled: () => {},
                graphVersionReset: () => graphVersionResets++,
                completeSearch: () => {},
            }
            let published = false
            host.setServeEffect("trigger", () => {
                if (published) return
                published = true
                host.define({
                    node: "unrelated",
                    get: get => get("unrelated-child"),
                })
                expect(valueOf(host.read<number>("unrelated"))).toBe(1)
            })
            host.define({
                node: "parent",
                get: get => {
                    get("seed-0")
                    get("approach-a-0")
                    get("approach-b-0")
                    get("trigger")
                    get("approach-c")
                    return 1
                },
            })

            const served = host.read<number>("parent")
            const searches =
                setup?.inspect
                    .export()
                    .details.filter(
                        (detail): detail is CycleSearchInspectionDetail =>
                            detail.type === "cycle-search" &&
                            detail.site === "new-edge-proof" &&
                            detail.target === "parent",
                    ) ?? []
            return Object.freeze({
                value: valueOf(served),
                dependencies: host.records
                    .get("parent")!
                    .dependencies.map(dependency => dependency.node),
                graphVersionResets,
                searches,
            })
        }

        const fast = run(false)
        const measured = run(true)

        expect(measured.value).toBe(fast.value)
        expect(measured.dependencies).toEqual(fast.dependencies)
        expect(measured.graphVersionResets).toBe(1)
        expect(measured.searches.map(search => search.visits)).toEqual([
            32, 41, 51, 1, 123,
        ])
    })

    test("keeps terminal gaps free and bounds repeated short disjoint misses", () => {
        const host = new TestHost()
        const depth = 40
        host.setLeaf("leaf", 1)
        const defineChain = (prefix: string, chainDepth = depth): void => {
            for (let index = chainDepth - 1; index >= 0; index--) {
                host.define({
                    node: `${prefix}-${index}`,
                    get: get =>
                        get(
                            index + 1 === chainDepth
                                ? "leaf"
                                : `${prefix}-${index + 1}`,
                        ),
                })
            }
            expect(valueOf(host.read<number>(`${prefix}-0`))).toBe(1)
        }
        defineChain("shared")
        for (const root of ["shared-a", "shared-b"]) {
            host.define({ node: root, get: get => get("shared-0") })
            expect(valueOf(host.read<number>(root))).toBe(1)
        }
        for (const terminal of ["terminal-a", "terminal-b"]) {
            host.define({ node: terminal, get: get => get("leaf") })
            expect(valueOf(host.read<number>(terminal))).toBe(1)
        }
        const disjointBranches = Array.from(
            { length: 17 },
            (_, index) => `disjoint-${index}`,
        )
        for (const branch of disjointBranches) defineChain(branch, 4)
        const kick: SelectorDefinition<Node, number> = {
            node: "kick",
            get: get => get("leaf"),
        }
        const dependencyOrder = [
            "kick",
            "shared-a",
            "terminal-a",
            "terminal-b",
            "shared-b",
            ...disjointBranches.map(branch => `${branch}-0`),
        ]
        const parent: SelectorDefinition<Node, number> = {
            node: "parent",
            get: get => {
                for (const dependency of dependencyOrder) get(dependency)
                return 1
            },
        }
        host.define(kick)
        host.define(parent)
        expect(valueOf(host.read<number>("parent"))).toBe(1)

        const setup = createInspectionRecorder()
        const hostRef = setup.recorder.reference(host, "scope")
        const memoAvailability: boolean[] = []
        host.cycleTrace = (
            start,
            target,
            cycleHost,
            session,
            site,
            acceptedPrefixLength,
            newEdgeProofMemo,
        ) => {
            if (site === 1) {
                memoAvailability.push(newEdgeProofMemo !== undefined)
            }
            return setup.recorder.findDependencyPath(
                "committed",
                hostRef,
                start,
                target,
                cycleHost,
                session,
                site,
                acceptedPrefixLength,
                cycleHost.getSelectorGraphVersion(),
                session.getSelectorGraphPublicationCount(cycleHost),
                false,
                newEdgeProofMemo,
            )
        }
        host.define(kick)
        host.markDirty("parent")
        host.selectorDependencyNodeReadNodes.length = 0

        expect(valueOf(host.read<number>("parent"))).toBe(1)
        // Sixteen four-node misses consume the 64-node cumulative budget. The
        // seventeenth proof must use the ordinary path with no memo supplied.
        expect(memoAvailability).toEqual([
            ...Array.from({ length: 21 }, () => true),
            false,
        ])
        const searches = setup.inspect
            .export()
            .details.filter(
                (detail): detail is CycleSearchInspectionDetail =>
                    detail.type === "cycle-search" &&
                    detail.site === "new-edge-proof",
            )
        expect(searches.map(search => search.start)).toEqual(dependencyOrder)
        expect(searches.reduce((sum, search) => sum + search.visits, 0)).toBe(
            114,
        )
        expect(host.selectorDependencyNodeReadNodes).toHaveLength(114)
        for (const terminal of ["terminal-a", "terminal-b"]) {
            expect(
                searches.find(search => search.start === terminal),
            ).toMatchObject({
                visits: 1,
                recordExpansions: 1,
                terminalPrunes: 0,
            })
        }
    })

    test("disables sharing after an over-cap hit-derived approach", () => {
        const host = new TestHost()
        host.setLeaf("leaf", 1)
        const kick: SelectorDefinition<Node, number> = {
            node: "kick",
            get: get => get("leaf"),
        }
        for (const node of ["root-a", "root-b"]) {
            host.define({ node, get: get => get("leaf") })
            expect(valueOf(host.read<number>(node))).toBe(1)
        }
        const parent: SelectorDefinition<Node, number> = {
            node: "parent",
            get: get =>
                get<number>("kick") +
                get<number>("root-a") +
                get<number>("root-b"),
        }
        host.define(kick)
        host.define(parent)
        expect(valueOf(host.read<number>("parent"))).toBe(3)

        const seedClosure = new Map<Node, unknown>()
        for (let index = 0; index < 32; index++) {
            seedClosure.set(`seed-${index}`, undefined)
        }
        const overCapClosure = new Map<Node, unknown>()
        for (let index = 0; index < 8_193; index++) {
            overCapClosure.set(`approach-${index}`, undefined)
        }

        const memoAvailability: boolean[] = []
        let proof = 0
        host.cycleTrace = (
            _start,
            _target,
            _cycleHost,
            _session,
            site,
            _acceptedPrefixLength,
            newEdgeProofMemo,
        ) => {
            if (site !== 1) return undefined
            memoAvailability.push(newEdgeProofMemo !== undefined)
            if (proof === 0) {
                expect(newEdgeProofMemo?.beginSearch()).toBe(false)
                newEdgeProofMemo?.completeNegative(seedClosure)
            } else if (proof === 1) {
                expect(newEdgeProofMemo?.beginSearch()).toBe(true)
                expect(newEdgeProofMemo?.hasProvenNoPath("seed-0")).toBe(true)
                newEdgeProofMemo?.completeNegative(overCapClosure)
            } else {
                expect(newEdgeProofMemo).toBeUndefined()
            }
            proof++
            return undefined
        }
        host.define(kick)
        host.markDirty("parent")

        expect(valueOf(host.read<number>("parent"))).toBe(3)
        expect(proof).toBe(3)
        expect(memoAvailability).toEqual([true, true, false])
    })

    test("gives a second large anchor one proof after crossing the miss budget", () => {
        const host = new TestHost()
        host.setLeaf("leaf", 1)
        const kick: SelectorDefinition<Node, number> = {
            node: "kick",
            get: get => get("leaf"),
        }
        const roots = Array.from({ length: 4 }, (_, index) => `root-${index}`)
        for (const root of roots) {
            host.define({ node: root, get: get => get("leaf") })
            expect(valueOf(host.read<number>(root))).toBe(1)
        }
        const parent: SelectorDefinition<Node, number> = {
            node: "parent",
            get: get => {
                let sum = get<number>("kick")
                for (const root of roots) sum += get<number>(root)
                return sum
            },
        }
        host.define(kick)
        host.define(parent)
        expect(valueOf(host.read<number>("parent"))).toBe(5)

        const makeClosure = (
            prefix: string,
            size: number,
        ): ReadonlyMap<Node, unknown> => {
            const closure = new Map<Node, unknown>()
            for (let index = 0; index < size; index++) {
                closure.set(`${prefix}-${index}`, undefined)
            }
            return closure
        }
        const closures = [
            makeClosure("first", 40),
            makeClosure("small-a", 16),
            makeClosure("small-b", 16),
            makeClosure("second", 400),
            makeClosure("approach", 2),
        ]
        const beginResults: boolean[] = []
        let proof = 0
        host.cycleTrace = (
            _start,
            _target,
            _cycleHost,
            _session,
            site,
            _acceptedPrefixLength,
            newEdgeProofMemo,
        ) => {
            if (site !== 1) return undefined
            expect(newEdgeProofMemo).toBeDefined()
            beginResults.push(newEdgeProofMemo!.beginSearch())
            if (proof === 4) {
                // The 400-node second anchor was admitted when cumulative miss
                // work reached 64. It must receive this one opportunity and be
                // consulted after the first anchor misses.
                expect(newEdgeProofMemo!.hasProvenNoPath("second-0")).toBe(true)
            }
            newEdgeProofMemo!.completeNegative(closures[proof]!)
            proof++
            return undefined
        }
        host.define(kick)
        host.markDirty("parent")

        expect(valueOf(host.read<number>("parent"))).toBe(5)
        expect(proof).toBe(5)
        expect(beginResults).toEqual([false, true, true, true, true])
    })

    test("keeps the ShiftX-shaped cached-cycle path exact", () => {
        const cycleIndex = 100
        const graph = buildShiftXHub(cycleIndex)
        const { store, inspect } = createInspectableStore({
            capacity: { summaries: 8_192, details: 250_000 },
        })
        warmShiftXHub(graph, store)
        inspect.reset()
        store.txn(transaction => {
            transaction.set(graph.source, 1)
            transaction.set(graph.close, true)
        }, "rewire-cycle")

        let thrown: unknown
        try {
            store.get(graph.hub)
        } catch (error) {
            thrown = error
        }
        expect(thrown).toBeInstanceOf(SelectorCircularDependencyError)
        const cycle = thrown as SelectorCircularDependencyError
        expect(cycle.selector).toBe(graph.hub)
        expect([...cycle.path]).toEqual([
            graph.hub,
            graph.lines[cycleIndex],
            graph.privates[cycleIndex],
            graph.echo,
            graph.hub,
        ])

        const report = inspect.export()
        const operation = report.summaries.find(
            summary =>
                summary.type === "operation" && summary.name === "rewire-cycle",
        )!
        const positives = report.details.filter(
            (detail): detail is CycleSearchInspectionDetail =>
                detail.type === "cycle-search" &&
                detail.operationId === operation.operationId &&
                detail.found,
        )
        expect(positives).toHaveLength(1)
        expect(positives[0]).toMatchObject({
            site: "new-edge-proof",
            start: { name: `line/${cycleIndex}` },
            target: { name: "hub" },
        })
        expect(
            positives[0]!.path!.map(
                reference => (reference as { name?: string }).name,
            ),
        ).toEqual([
            `line/${cycleIndex}`,
            `private/${cycleIndex}`,
            "echo",
            "hub",
        ])
    })
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
