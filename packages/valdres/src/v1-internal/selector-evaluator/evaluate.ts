import {
    InvalidSelectorComparatorResultError,
    InvalidSynchronousSelectorResultError,
    SelectorCircularDependencyError,
    SelectorComparatorError,
    SelectorDependencyError,
    SelectorGetterError,
    SelectorReadRevokedError,
} from "./errors"
import type {
    SelectorComparisonBaseline,
    SelectorDefinition,
    SelectorDependencySnapshot,
    SelectorNewEdgeProofDiagnostics,
    SelectorNewEdgeProofMemoDisableReason,
    SelectorNewEdgeProofMemoSeedReason,
    SelectorEvaluationHost,
    SelectorEvaluationProposal,
    SelectorEvaluationSession,
    SelectorNewEdgeProofMemo,
    SelectorNewEdgeProofMemoProvider,
    SelectorOutcome,
    SelectorCycleSearch,
    SelectorCycleSearchSite,
    SelectorGraphEdgeAddition,
    SelectorGraphObservation,
    SelectorGraphTraversalBudget,
    SelectorTopologyDeltaReverseProofContext,
    SelectorTopologyDeltaReverseSnapshotDiagnostics,
} from "./types"

type InspectedThenable =
    | Readonly<{ kind: "not-thenable" }>
    | Readonly<{
          kind: "thenable"
          target: object | ((...args: never[]) => unknown)
          then: (...args: unknown[]) => unknown
      }>
    | Readonly<{ kind: "inspection-error"; error: unknown }>

const NOT_THENABLE = Object.freeze({ kind: "not-thenable" as const })
const NOOP = (): void => {}
const APPLY = Reflect.apply
const DEPENDENCY_PATH_ROOT = Symbol("selector dependency path root")

const inspectThenable = (value: unknown): InspectedThenable => {
    if (
        (typeof value !== "object" || value === null) &&
        typeof value !== "function"
    ) {
        return NOT_THENABLE
    }

    try {
        const then = (value as { readonly then?: unknown }).then
        return typeof then === "function"
            ? Object.freeze({
                  kind: "thenable" as const,
                  target: value,
                  then: then as (...args: unknown[]) => unknown,
              })
            : NOT_THENABLE
    } catch (error) {
        return Object.freeze({ kind: "inspection-error" as const, error })
    }
}

const containThenable = (
    inspected: Extract<InspectedThenable, { kind: "thenable" }>,
): void => {
    try {
        APPLY(inspected.then, inspected.target, [undefined, NOOP])
    } catch {
        // The synchronous State boundary is already failed. Containment itself
        // must not replace that named outcome or inspect hostile thrown values.
    }
}

const freezeOutcome = <Value>(
    outcome: SelectorOutcome<Value>,
): SelectorOutcome<Value> => Object.freeze(outcome)

const freezeDependencies = <Node, Token extends object>(
    dependencies: SelectorDependencySnapshot<Node, Token>[],
): readonly SelectorDependencySnapshot<Node, Token>[] =>
    Object.freeze(dependencies)

const makeProposal = <Node, Token extends object, Value>(
    selector: Node,
    token: Token,
    outcome: SelectorOutcome<Value>,
    dependencies: SelectorDependencySnapshot<Node, Token>[],
): SelectorEvaluationProposal<Node, Token, Value> => {
    const frozenDependencies = freezeDependencies(dependencies)
    return Object.freeze({
        selector,
        token,
        outcome: freezeOutcome(outcome),
        dependencies: frozenDependencies,
        attemptedPrefix:
            outcome.kind === "value"
                ? EMPTY_ATTEMPTED_PREFIX
                : Object.freeze(
                      frozenDependencies.map(dependency => dependency.node),
                  ),
    })
}

const EMPTY_ATTEMPTED_PREFIX = Object.freeze([]) as readonly never[]

// Retaining the existing DFS parent maps avoids copying any closure. Admission
// is deliberately conservative: a useful seed must first pay for itself,
// bounded disjoint work disables learning, and at most two proposal-local
// anchors are ever retained.
const NEW_EDGE_MEMO_MIN_SEED_SIZE = 32
const NEW_EDGE_MEMO_MAX_ANCHOR_SIZE = 8_192
const NEW_EDGE_MEMO_MAX_MISS_WORK = 2 * NEW_EDGE_MEMO_MIN_SEED_SIZE
const REVERSE_PROOF_MAX_WORK = 128
const TOPOLOGY_DELTA_REVERSE_SNAPSHOT_MAX_ENTRIES = 4_096

export type SelectorReverseProofOutcome =
    | "unsupported"
    | "ineligible-active-frames"
    | "proven-terminal"
    | "proven-reverse"
    | "path-possible"
    | "budget-exhausted"
    | "disabled"

export interface SelectorReverseProofMeasurement {
    nodeVisits: number
    dependentProbes: number
    liveDependents: number
    maxFrontier: number
}

interface ResettableNewEdgeProofMemo<Node>
    extends SelectorNewEdgeProofMemo<Node> {
    reset(): void
    advanceGraphVersion(
        addedEdges: readonly SelectorGraphEdgeAddition<Node>[] | undefined,
    ): boolean
}

class NewEdgeProofMemo<Node> implements ResettableNewEdgeProofMemo<Node> {
    readonly passiveSearches: number
    declare readonly diagnostics: SelectorNewEdgeProofDiagnostics | undefined
    searches = 0
    declare first: ReadonlyMap<Node, unknown> | undefined
    declare second: ReadonlyMap<Node, unknown> | undefined
    declare firstIndependentlyClosed: boolean | undefined
    declare secondIndependentlyClosed: boolean | undefined
    declare hits: number | undefined
    declare missWork: number | undefined
    declare locked: boolean | undefined
    declare disabled: boolean | undefined
    declare consultCurrentSearch: boolean | undefined
    declare passiveOrigin: boolean | undefined
    declare passiveProbeBudget: number | undefined
    declare diagnosticsCompleted: boolean | undefined
    declare mapProbes: number | undefined
    declare prunedNodes: number | undefined

    constructor(
        passiveSearches: number,
        diagnostics?: SelectorNewEdgeProofDiagnostics,
    ) {
        this.passiveSearches = passiveSearches
        if (diagnostics !== undefined) this.diagnostics = diagnostics
    }

    get enabled(): boolean {
        return this.disabled !== true
    }

    beginSearch(): boolean {
        this.searches++
        if (this.diagnostics !== undefined) {
            this.diagnosticsCompleted = false
            this.mapProbes = 0
            this.prunedNodes = 0
        }
        const consult =
            this.enabled &&
            this.searches > this.passiveSearches &&
            this.first !== undefined
        if (consult) {
            this.consultCurrentSearch = true
            this.hits = 0
        } else if (this.consultCurrentSearch === true) {
            this.consultCurrentSearch = undefined
        }
        if (
            consult &&
            this.passiveOrigin === true &&
            this.searches === this.passiveSearches + 1 &&
            this.passiveProbeBudget === undefined
        ) {
            this.passiveProbeBudget = Math.min(
                NEW_EDGE_MEMO_MAX_ANCHOR_SIZE,
                2 * this.first!.size,
            )
        }
        return consult
    }

    hasProvenNoPath(node: Node): boolean {
        if (!this.enabled) return false
        const first = this.first
        if (first !== undefined) {
            const remaining = this.passiveProbeBudget
            if (remaining === 0) {
                this.disable("passive-probe-budget")
                return false
            }
            if (first.has(node)) {
                this.hits = (this.hits ?? 0) | 1
                this.passiveOrigin = undefined
                this.passiveProbeBudget = undefined
                return true
            }
            if (remaining !== undefined) {
                this.passiveProbeBudget = remaining - 1
                if (remaining === 1) {
                    this.disable("passive-probe-budget")
                    return false
                }
            }
        }

        const second = this.second
        if (second !== undefined) {
            const remaining = this.passiveProbeBudget
            if (remaining === 0) {
                this.disable("passive-probe-budget")
                return false
            }
            if (second.has(node)) {
                this.hits = (this.hits ?? 0) | 2
                this.passiveOrigin = undefined
                this.passiveProbeBudget = undefined
                return true
            }
            if (remaining !== undefined) {
                this.passiveProbeBudget = remaining - 1
                if (remaining === 1) {
                    this.disable("passive-probe-budget")
                    return false
                }
            }
        }
        return false
    }

    hasProvenNoPathMeasured(node: Node): boolean {
        if (!this.enabled) return false
        const first = this.first
        if (first !== undefined) {
            const remaining = this.passiveProbeBudget
            if (remaining === 0) {
                this.disable("passive-probe-budget")
                return false
            }
            this.mapProbes = (this.mapProbes ?? 0) + 1
            if (first.has(node)) {
                this.hits = (this.hits ?? 0) | 1
                this.prunedNodes = (this.prunedNodes ?? 0) + 1
                this.passiveOrigin = undefined
                this.passiveProbeBudget = undefined
                return true
            }
            if (remaining !== undefined) {
                this.passiveProbeBudget = remaining - 1
                if (remaining === 1) {
                    this.disable("passive-probe-budget")
                    return false
                }
            }
        }

        const second = this.second
        if (second !== undefined) {
            const remaining = this.passiveProbeBudget
            if (remaining === 0) {
                this.disable("passive-probe-budget")
                return false
            }
            this.mapProbes = (this.mapProbes ?? 0) + 1
            if (second.has(node)) {
                this.hits = (this.hits ?? 0) | 2
                this.prunedNodes = (this.prunedNodes ?? 0) + 1
                this.passiveOrigin = undefined
                this.passiveProbeBudget = undefined
                return true
            }
            if (remaining !== undefined) {
                this.passiveProbeBudget = remaining - 1
                if (remaining === 1) {
                    this.disable("passive-probe-budget")
                    return false
                }
            }
        }
        return false
    }

    completeNegative(closure: ReadonlyMap<Node, unknown>): void {
        if (!this.enabled) return

        // A warm narrow parent observes its first three proofs without a
        // lookup. Proof one may seed one bounded passive anchor. A qualifying
        // proof three replaces it so current proof-three to proof-four sharing
        // is preserved; proof two never retains a second anchor. A terminal or
        // small proof three keeps proof one's evidence, covering the ShiftX
        // large/terminal/terminal/large sequence without new probes in one-
        // through three-proof cases.
        if (this.searches <= this.passiveSearches) {
            const mayRetain =
                closure.size >= NEW_EDGE_MEMO_MIN_SEED_SIZE &&
                closure.size <= NEW_EDGE_MEMO_MAX_ANCHOR_SIZE
            let seed: SelectorNewEdgeProofMemoSeedReason | undefined
            if (this.searches === 1 && mayRetain) {
                this.first = closure
                this.firstIndependentlyClosed = true
                this.passiveOrigin = true
                seed = "initial"
            } else if (this.searches === this.passiveSearches && mayRetain) {
                seed =
                    this.first === undefined
                        ? "initial"
                        : "activation-replacement"
                this.first = closure
                this.firstIndependentlyClosed = true
                this.second = undefined
                this.secondIndependentlyClosed = undefined
                this.passiveOrigin = undefined
                this.passiveProbeBudget = undefined
            }
            this.completeDiagnostics(seed)
            return
        }

        if ((this.hits ?? 0) !== 0) {
            // A broad approach that only touches a much smaller retained tail
            // is not useful evidence to keep probing. It cannot be retained
            // within the liveness bound, so disable instead of repeatedly
            // resetting the miss budget on every broad walk.
            if (closure.size > NEW_EDGE_MEMO_MAX_ANCHOR_SIZE) {
                this.disable("over-cap-hit")
                return
            }
            const priorFirst = this.first
            const priorSecond = this.second
            const priorFirstIndependentlyClosed =
                this.firstIndependentlyClosed === true
            const priorSecondIndependentlyClosed =
                this.secondIndependentlyClosed === true
            this.first = undefined
            this.second = undefined
            this.firstIndependentlyClosed = undefined
            this.secondIndependentlyClosed = undefined
            this.retain(priorFirst, priorFirstIndependentlyClosed)
            this.retain(priorSecond, priorSecondIndependentlyClosed)
            const retainedApproach = this.retain(closure, false)
            this.locked = true
            this.missWork = 0
            this.completeDiagnostics(
                retainedApproach ? "hit-derived" : undefined,
            )
            return
        }

        // Terminal roots never perform a Map lookup and do not count as
        // evidence against overlap.
        if (closure.size === 1) {
            this.completeDiagnostics()
            return
        }
        const mayRetain =
            closure.size >= NEW_EDGE_MEMO_MIN_SEED_SIZE &&
            closure.size <= NEW_EDGE_MEMO_MAX_ANCHOR_SIZE
        if (this.first === undefined) {
            if (mayRetain) {
                this.first = closure
                this.firstIndependentlyClosed = true
            }
            this.completeDiagnostics(mayRetain ? "initial" : undefined)
            return
        }

        this.missWork =
            (this.missWork ?? 0) +
            Math.min(closure.size, NEW_EDGE_MEMO_MIN_SEED_SIZE)
        if (this.locked !== true && this.second === undefined && mayRetain) {
            // A second substantial closure receives one following proof to
            // demonstrate overlap even when admission crosses the miss budget.
            this.second = closure
            this.secondIndependentlyClosed = true
            this.completeDiagnostics("secondary")
            return
        }
        if ((this.missWork ?? 0) >= NEW_EDGE_MEMO_MAX_MISS_WORK) {
            this.disable("miss-budget")
            return
        }
        this.completeDiagnostics()
    }

    completePositive(): void {
        this.completeDiagnostics()
    }

    advanceGraphVersion(
        addedEdges: readonly SelectorGraphEdgeAddition<Node>[] | undefined,
    ): boolean {
        if (!this.enabled || addedEdges === undefined) {
            this.reset()
            return false
        }

        const closedFirst =
            this.firstIndependentlyClosed === true ? this.first : undefined
        const closedSecond =
            this.secondIndependentlyClosed === true ? this.second : undefined
        const anchor =
            closedFirst === undefined ||
            (closedSecond !== undefined && closedSecond.size > closedFirst.size)
                ? closedSecond
                : closedFirst
        if (anchor === undefined) {
            this.reset()
            return false
        }

        // Until a carried anchor proves useful, one cumulative budget bounds
        // both exact-delta membership checks and speculative DFS probes. A hit
        // clears it, so a later version transition can start one fresh bounded
        // trial for the still-local certificate. Safe transitions without an
        // intervening hit never replenish the budget.
        if (this.passiveProbeBudget === undefined) {
            this.passiveOrigin = true
            this.passiveProbeBudget = Math.min(
                NEW_EDGE_MEMO_MAX_ANCHOR_SIZE,
                2 * anchor.size,
            )
        }
        let mapProbes = 0
        for (const edge of addedEdges) {
            const tailIsInside = this.hasWithinCrossVersionBudget(
                anchor,
                edge.tail,
            )
            if (tailIsInside === undefined) {
                this.diagnostics?.recordMapProbes?.(mapProbes)
                this.reset()
                return false
            }
            mapProbes++
            if (!tailIsInside) continue
            const headIsInside = this.hasWithinCrossVersionBudget(
                anchor,
                edge.head,
            )
            if (headIsInside === undefined) {
                this.diagnostics?.recordMapProbes?.(mapProbes)
                this.reset()
                return false
            }
            mapProbes++
            if (!headIsInside) {
                this.diagnostics?.recordMapProbes?.(mapProbes)
                this.reset()
                return false
            }
        }
        this.diagnostics?.recordMapProbes?.(mapProbes)
        if (this.passiveProbeBudget === 0) {
            this.reset()
            return false
        }

        // Hit-derived approach maps are only valid together with the map they
        // pruned through. Cross-version survival keeps one independently
        // exhausted, successor-closed map and never extends its lifetime with
        // partial evidence.
        this.first = anchor
        this.firstIndependentlyClosed = true
        this.second = undefined
        this.secondIndependentlyClosed = undefined
        this.hits = undefined
        this.consultCurrentSearch = undefined
        this.diagnosticsCompleted = undefined
        this.mapProbes = undefined
        this.prunedNodes = undefined
        return true
    }

    reset(): void {
        this.first = undefined
        this.second = undefined
        this.firstIndependentlyClosed = undefined
        this.secondIndependentlyClosed = undefined
        this.hits = undefined
        this.missWork = undefined
        this.locked = undefined
        this.disabled = undefined
        this.searches = 0
        this.consultCurrentSearch = undefined
        this.passiveOrigin = undefined
        this.passiveProbeBudget = undefined
        this.diagnosticsCompleted = undefined
        this.mapProbes = undefined
        this.prunedNodes = undefined
    }

    private retain(
        candidate: ReadonlyMap<Node, unknown> | undefined,
        independentlyClosed = false,
    ): boolean {
        if (
            candidate === undefined ||
            candidate.size > NEW_EDGE_MEMO_MAX_ANCHOR_SIZE ||
            candidate === this.first
        ) {
            return false
        }
        if (this.first === undefined || candidate.size > this.first.size) {
            this.second = this.first
            this.secondIndependentlyClosed = this.firstIndependentlyClosed
            this.first = candidate
            this.firstIndependentlyClosed = independentlyClosed
            return true
        }
        if (this.second === undefined || candidate.size > this.second.size) {
            this.second = candidate
            this.secondIndependentlyClosed = independentlyClosed
            return true
        }
        return false
    }

    private disable(reason: SelectorNewEdgeProofMemoDisableReason): void {
        this.first = undefined
        this.second = undefined
        this.firstIndependentlyClosed = undefined
        this.secondIndependentlyClosed = undefined
        this.missWork = undefined
        this.disabled = true
        this.passiveOrigin = undefined
        this.passiveProbeBudget = undefined
        this.completeDiagnostics(undefined, reason)
    }

    private hasWithinCrossVersionBudget(
        anchor: ReadonlyMap<Node, unknown>,
        node: Node,
    ): boolean | undefined {
        const remaining = this.passiveProbeBudget
        if (remaining === undefined || remaining === 0) return undefined
        const contains = anchor.has(node)
        this.passiveProbeBudget = remaining - 1
        return contains
    }

    private completeDiagnostics(
        seed?: SelectorNewEdgeProofMemoSeedReason,
        disable?: SelectorNewEdgeProofMemoDisableReason,
    ): void {
        const diagnostics = this.diagnostics
        if (diagnostics === undefined || this.diagnosticsCompleted === true) {
            return
        }
        this.diagnosticsCompleted = true
        const mapProbes = this.mapProbes ?? 0
        diagnostics.completeSearch(
            this.consultCurrentSearch === true
                ? (this.hits ?? 0) !== 0
                    ? "consulted-pruned"
                    : "consulted-no-prune"
                : "observing",
            seed,
            disable,
            mapProbes,
            this.prunedNodes ?? 0,
            (this.first?.size ?? 0) + (this.second?.size ?? 0),
        )
    }
}

const createNewEdgeProofMemo = <Node>(
    passiveSearches: number,
    diagnostics?: SelectorNewEdgeProofDiagnostics,
): ResettableNewEdgeProofMemo<Node> =>
    new NewEdgeProofMemo(passiveSearches, diagnostics)

const finishReverseProof = (
    outcome: SelectorReverseProofOutcome,
    budget: SelectorGraphTraversalBudget,
    nodeVisits: number,
    liveDependents: number,
    maxFrontier: number,
    measurement?: SelectorReverseProofMeasurement,
): SelectorReverseProofOutcome => {
    if (measurement !== undefined) {
        measurement.nodeVisits = nodeVisits
        measurement.dependentProbes =
            REVERSE_PROOF_MAX_WORK - budget.remaining - nodeVisits
        measurement.liveDependents = liveDependents
        measurement.maxFrontier = maxFrontier
    }
    return outcome
}

/**
 * Try the cheap direction first for a new-edge or topology-delta proof. Without
 * an overlay, committed reverse adjacency describes the relevant effective
 * graph only while `target` is the host's sole active frame. A topology-delta
 * snapshot adds every active transient-prefix edge. Stale committed edges are
 * retained deliberately: they can only cause conservative canonical fallback.
 * Any positive, bounded, or ineligible case is left to the ordered forward DFS.
 */
export const tryProveNoDependencyPathReverse = <Node, Token extends object>(
    start: Node,
    target: Node,
    host: SelectorEvaluationHost<Node, Token>,
    session: SelectorEvaluationSession<Node>,
    measurement?: SelectorReverseProofMeasurement,
    allowTraversal = true,
    transientDependents?: ReadonlyMap<Node, readonly Node[]>,
): SelectorReverseProofOutcome => {
    if (measurement !== undefined) {
        measurement.nodeVisits = 0
        measurement.dependentProbes = 0
        measurement.liveDependents = 0
        measurement.maxFrontier = 0
    }
    const visitDependents = host.visitSelectorDependents
    if (visitDependents === undefined) return "unsupported"
    if (
        transientDependents === undefined &&
        !session.isSoleActiveSelector(host, target)
    ) {
        return "ineligible-active-frames"
    }
    if (!Object.is(start, target)) {
        const transient =
            transientDependents === undefined
                ? undefined
                : session.getTransientDependencies(host, start)
        if (transient !== undefined) {
            if (transient.length === 0) return "proven-terminal"
        } else {
            const getDependencies = host.getSelectorDependencyNodes
            if (getDependencies !== undefined) {
                const dependencies = getDependencies.call(host, start)
                if (dependencies === undefined || dependencies.length === 0) {
                    return "proven-terminal"
                }
            }
        }
    }
    if (!allowTraversal) return "disabled"

    const budget: SelectorGraphTraversalBudget = {
        remaining: REVERSE_PROOF_MAX_WORK,
    }
    const pending = [target]
    const visited = new Set<Node>(pending)
    let nodeVisits = 0
    let liveDependents = 0
    let maxFrontier = 1

    while (pending.length > 0) {
        if (budget.remaining === 0) {
            return finishReverseProof(
                "budget-exhausted",
                budget,
                nodeVisits,
                liveDependents,
                maxFrontier,
                measurement,
            )
        }
        budget.remaining--
        nodeVisits++
        const node = pending.pop() as Node
        if (Object.is(node, start)) {
            return finishReverseProof(
                "path-possible",
                budget,
                nodeVisits,
                liveDependents,
                maxFrontier,
                measurement,
            )
        }

        let reachedStart = false
        const visitDependent = (dependent: Node): boolean => {
            liveDependents++
            if (Object.is(dependent, start)) {
                reachedStart = true
                return false
            }
            if (!visited.has(dependent)) {
                visited.add(dependent)
                pending.push(dependent)
                if (pending.length > maxFrontier) {
                    maxFrontier = pending.length
                }
            }
            return true
        }
        const exhausted = visitDependents.call(
            host,
            node,
            budget,
            visitDependent,
        )
        if (reachedStart) {
            return finishReverseProof(
                "path-possible",
                budget,
                nodeVisits,
                liveDependents,
                maxFrontier,
                measurement,
            )
        }
        if (!exhausted) {
            return finishReverseProof(
                "budget-exhausted",
                budget,
                nodeVisits,
                liveDependents,
                maxFrontier,
                measurement,
            )
        }

        const transient = transientDependents?.get(node)
        if (transient !== undefined) {
            for (const dependent of transient) {
                if (budget.remaining === 0) {
                    return finishReverseProof(
                        "budget-exhausted",
                        budget,
                        nodeVisits,
                        liveDependents,
                        maxFrontier,
                        measurement,
                    )
                }
                budget.remaining--
                if (!visitDependent(dependent)) {
                    return finishReverseProof(
                        "path-possible",
                        budget,
                        nodeVisits,
                        liveDependents,
                        maxFrontier,
                        measurement,
                    )
                }
            }
        }
    }

    return finishReverseProof(
        "proven-reverse",
        budget,
        nodeVisits,
        liveDependents,
        maxFrontier,
        measurement,
    )
}

const findDependencyPathFast = <Node, Token extends object>(
    start: Node,
    target: Node,
    host: SelectorEvaluationHost<Node, Token>,
    session: SelectorEvaluationSession<Node>,
    _site: SelectorCycleSearchSite,
    _acceptedPrefixLength: number,
    getNewEdgeProofMemo?: SelectorNewEdgeProofMemoProvider<Node>,
    topologyDeltaReverseProof?: SelectorTopologyDeltaReverseProofContext<Node>,
): readonly Node[] | undefined => {
    if (_site === 1 || _site === 2) {
        const reverseProof = tryProveNoDependencyPathReverse(
            start,
            target,
            host,
            session,
            undefined,
            _site === 1
                ? (getNewEdgeProofMemo?.reverseProofEnabled ?? true)
                : (topologyDeltaReverseProof?.reverseProofEnabled ?? true),
            topologyDeltaReverseProof?.transientDependents,
        )
        if (
            reverseProof === "proven-terminal" ||
            reverseProof === "proven-reverse"
        ) {
            return undefined
        }
        if (reverseProof === "budget-exhausted") {
            if (_site === 1 && getNewEdgeProofMemo !== undefined) {
                getNewEdgeProofMemo.reverseProofEnabled = false
            } else if (topologyDeltaReverseProof !== undefined) {
                topologyDeltaReverseProof.reverseProofEnabled = false
            }
        }
    }
    const newEdgeProofMemo = getNewEdgeProofMemo?.()
    let consultMemo = newEdgeProofMemo?.beginSearch() ?? false
    const pending = [start]
    const parent = new Map<Node, Node | typeof DEPENDENCY_PATH_ROOT>([
        [start, DEPENDENCY_PATH_ROOT],
    ])

    while (pending.length > 0) {
        const node = pending.pop() as Node
        if (Object.is(node, target)) {
            const reversed: Node[] = []
            let cursor: Node | typeof DEPENDENCY_PATH_ROOT = node
            while (cursor !== DEPENDENCY_PATH_ROOT) {
                reversed.push(cursor)
                cursor = parent.get(cursor) as
                    | Node
                    | typeof DEPENDENCY_PATH_ROOT
            }
            reversed.reverse()
            newEdgeProofMemo?.completePositive()
            return Object.freeze(reversed)
        }
        const transient = session.getTransientDependencies(host, node)
        if (transient) {
            if (transient.length === 0) continue
            if (consultMemo) {
                const proven = newEdgeProofMemo!.hasProvenNoPath(node)
                if (!newEdgeProofMemo!.enabled) consultMemo = false
                if (proven) continue
            }
            for (const dependency of transient) {
                if (parent.has(dependency.node)) continue
                parent.set(dependency.node, node)
                pending.push(dependency.node)
            }
            continue
        }

        if (host.getSelectorDependencyNodes !== undefined) {
            const dependencies = host.getSelectorDependencyNodes(node)
            if (dependencies === undefined || dependencies.length === 0) {
                continue
            }
            if (consultMemo) {
                const proven = newEdgeProofMemo!.hasProvenNoPath(node)
                if (!newEdgeProofMemo!.enabled) consultMemo = false
                if (proven) continue
            }
            for (const dependency of dependencies) {
                if (parent.has(dependency)) continue
                parent.set(dependency, node)
                pending.push(dependency)
            }
            continue
        }

        const record = host.getSelectorRecord(node)
        if (!record || record.dependencies.length === 0) continue
        if (consultMemo) {
            const proven = newEdgeProofMemo!.hasProvenNoPath(node)
            if (!newEdgeProofMemo!.enabled) consultMemo = false
            if (proven) continue
        }
        for (const dependency of record.dependencies) {
            if (parent.has(dependency.node)) continue
            parent.set(dependency.node, node)
            pending.push(dependency.node)
        }
    }

    newEdgeProofMemo?.completeNegative(parent)
    return undefined
}

const classifyThrown = (
    thrown: unknown,
    phase: "getter" | "comparator",
): unknown => {
    const inspected = inspectThenable(thrown)
    if (inspected.kind === "thenable") {
        containThenable(inspected)
        return new InvalidSynchronousSelectorResultError(phase)
    }
    if (inspected.kind === "inspection-error") return inspected.error
    return thrown
}

const classifyReturned = (
    returned: unknown,
    phase: "getter" | "comparator",
):
    | Readonly<{ kind: "value"; value: unknown }>
    | Readonly<{ kind: "error"; error: unknown }> => {
    const inspected = inspectThenable(returned)
    if (inspected.kind === "thenable") {
        containThenable(inspected)
        return Object.freeze({
            kind: "error",
            error: new InvalidSynchronousSelectorResultError(phase),
        })
    }
    if (inspected.kind === "inspection-error") {
        return Object.freeze({ kind: "error", error: inspected.error })
    }
    return Object.freeze({ kind: "value", value: returned })
}

/**
 * Evaluate exactly one selector body. This function never installs the active
 * selector record; persistent, scratch, and hydration hosts apply the returned
 * immutable proposal under their own publication policy.
 */
export const evaluateSelector = <Node, Token extends object, Value>(
    definition: SelectorDefinition<Node, Value>,
    host: SelectorEvaluationHost<Node, Token>,
    session: SelectorEvaluationSession<Node>,
    cycleSearch: SelectorCycleSearch<Node, Token> = findDependencyPathFast,
    newEdgeProofDiagnostics?: SelectorNewEdgeProofDiagnostics,
    topologyDeltaReverseSnapshotDiagnostics?: SelectorTopologyDeltaReverseSnapshotDiagnostics,
): SelectorEvaluationProposal<Node, Token, Value> => {
    const { node: selector } = definition
    const dependencies: SelectorDependencySnapshot<Node, Token>[] = []
    const currentRecord = host.getSelectorRecord(selector)
    const currentDependencies = currentRecord?.dependencies
    let dependencyNodes =
        currentDependencies === undefined ? new Set<Node>() : undefined
    let unorderedCurrentDependencyNodes: Set<Node> | undefined
    let prefixTruncationRevision = 0
    const comparisonBaseline = host.getComparisonBaseline(selector) as
        | SelectorComparisonBaseline<Token, Value>
        | undefined
    let suppliedReadActive = true

    const materializeDependencyNodes = (): Set<Node> => {
        let current = dependencyNodes
        if (current !== undefined) return current
        current = new Set<Node>()
        for (const dependency of dependencies) {
            current.add(dependency.node)
        }
        dependencyNodes = current
        return current
    }

    session.enter(host, selector, dependencies)
    const graphVersionAtEntry = host.getSelectorGraphVersion()
    const sessionPublicationsAtEntry =
        session.getSelectorGraphPublicationCount(host)
    let prefixProofVersion = graphVersionAtEntry
    let prefixProofSessionPublications = sessionPublicationsAtEntry
    let observedGraphVersion = graphVersionAtEntry
    let observedSessionPublications = sessionPublicationsAtEntry
    let graphObservation: SelectorGraphObservation<Node> | undefined
    let graphObservationStarted = false
    let newEdgeProofMemoVersion = graphVersionAtEntry
    let newEdgeProofsInEpoch = 0
    let newEdgeProofMemo: ResettableNewEdgeProofMemo<Node> | undefined
    let requestedNewEdgeProofMemoVersion = graphVersionAtEntry
    let provideNewEdgeProofMemo:
        | SelectorNewEdgeProofMemoProvider<Node>
        | undefined

    const reconcileNewEdgeProofMemoVersion = (
        graphVersion: number,
        addedEdges: readonly SelectorGraphEdgeAddition<Node>[] | undefined,
    ): void => {
        if (graphVersion === newEdgeProofMemoVersion) return
        newEdgeProofMemoVersion = graphVersion
        if (newEdgeProofMemo === undefined) {
            newEdgeProofsInEpoch = 0
            return
        }
        if (newEdgeProofMemo.advanceGraphVersion(addedEdges)) return
        newEdgeProofsInEpoch = 0
        newEdgeProofDiagnostics?.graphVersionReset()
    }

    const getNewEdgeProofMemo = (
        graphVersion: number,
    ): SelectorNewEdgeProofMemo<Node> | undefined => {
        if (graphVersion !== newEdgeProofMemoVersion) {
            // A graph transition normally reconciles through the observation
            // consumed by revalidateOwnPrefix. Any unexplained mismatch is
            // incomplete evidence and must fail closed.
            reconcileNewEdgeProofMemoVersion(graphVersion, undefined)
        }
        newEdgeProofsInEpoch++
        // Warm wide parents activate learning on their first retained-edge
        // re-proof. Warm narrow parents may retain proof one passively because
        // their existing record rules out first-materialization noise. Cold
        // and warm-zero proposals still wait for three proofs in one exact or
        // delta-certified learning epoch, avoiding allocation on singleton
        // paths.
        if (
            (currentDependencies?.length ?? 0) === 0 &&
            newEdgeProofsInEpoch < 3
        ) {
            newEdgeProofDiagnostics?.admissionSkipped()
            return undefined
        }
        if (newEdgeProofMemo === undefined) {
            const warmNarrowParent =
                currentDependencies !== undefined &&
                currentDependencies.length > 0 &&
                currentDependencies.length < 3
            newEdgeProofMemo = createNewEdgeProofMemo<Node>(
                warmNarrowParent ? 3 : 0,
                newEdgeProofDiagnostics,
            )
        }
        if (!newEdgeProofMemo.enabled) {
            newEdgeProofDiagnostics?.disabled()
            return undefined
        }
        return newEdgeProofMemo
    }
    const beginGraphObservation = (dependency: Node): void => {
        if (graphObservationStarted) return
        const observation = host.beginSelectorGraphObservation?.(dependency)
        if (observation === undefined) return
        graphObservationStarted = true
        graphObservation = observation
    }

    const hasOnlyAttributedPublications = (
        graphVersionBefore: number,
        sessionPublicationsBefore: number,
        graphVersionAfter: number,
        sessionPublicationsAfter: number,
    ): boolean =>
        graphVersionAfter - graphVersionBefore ===
        sessionPublicationsAfter - sessionPublicationsBefore

    const revalidateOwnPrefix = (
        graphVersion = host.getSelectorGraphVersion(),
        sessionPublications = session.getSelectorGraphPublicationCount(host),
        onlyAttributed = hasOnlyAttributedPublications(
            prefixProofVersion,
            prefixProofSessionPublications,
            graphVersion,
            sessionPublications,
        ),
    ): void => {
        if (graphVersion === prefixProofVersion) return
        if (
            !graphObservationStarted &&
            host.beginSelectorGraphObservation !== undefined
        ) {
            // Every accepted dependency has been declined by the host, which
            // certifies that the prefix is selector-graph-terminal. A foreign
            // publication cannot add a path from that prefix back here. The
            // selector currently being served is not accepted yet and still
            // receives the ordinary new-edge proof below.
            reconcileNewEdgeProofMemoVersion(graphVersion, undefined)
            prefixProofVersion = graphVersion
            prefixProofSessionPublications = sessionPublications
            return
        }
        const addedEdges = graphObservation?.takeAddedEdges()
        // The observation cursor is destructive. Fan this one exact interval
        // out to both proof systems before either takes an early return.
        reconcileNewEdgeProofMemoVersion(graphVersion, addedEdges)
        if (onlyAttributed) {
            prefixProofVersion = graphVersion
            prefixProofSessionPublications = sessionPublications
            return
        }
        if (addedEdges !== undefined) {
            // The prior effective graph was proved acyclic. Any cycle created
            // since then must contain an added tail -> head edge, so the final
            // graph must contain the complementary head -> tail path. This is
            // a negative-only certificate: a positive result falls back to
            // the ordered proof below for canonical blame and path.
            const transientDependents =
                addedEdges.length === 0 ||
                host.visitSelectorDependents === undefined
                    ? undefined
                    : session.captureTransientReverseDependents(
                          host,
                          selector,
                          dependencies.length,
                          TOPOLOGY_DELTA_REVERSE_SNAPSHOT_MAX_ENTRIES,
                          topologyDeltaReverseSnapshotDiagnostics,
                      )
            const topologyDeltaReverseProof:
                | SelectorTopologyDeltaReverseProofContext<Node>
                | undefined =
                addedEdges.length === 0
                    ? undefined
                    : {
                          transientDependents,
                          reverseProofEnabled: true,
                      }
            let addedEdgeMayCloseCycle = false
            for (const edge of addedEdges) {
                if (
                    cycleSearch(
                        edge.head,
                        edge.tail,
                        host,
                        session,
                        2,
                        dependencies.length,
                        undefined,
                        topologyDeltaReverseProof,
                    ) !== undefined
                ) {
                    addedEdgeMayCloseCycle = true
                    break
                }
            }
            if (!addedEdgeMayCloseCycle) {
                prefixProofVersion = graphVersion
                prefixProofSessionPublications = sessionPublications
                return
            }
        }
        for (let index = 0; index < dependencies.length; index++) {
            const dependency = dependencies[index]!
            const cyclePath = cycleSearch(
                dependency.node,
                selector,
                host,
                session,
                0,
                dependencies.length,
            )
            if (!cyclePath) continue

            if (dependencyNodes !== undefined) {
                for (
                    let removeIndex = dependencies.length - 1;
                    removeIndex >= index;
                    removeIndex--
                ) {
                    dependencyNodes.delete(dependencies[removeIndex]!.node)
                }
            }
            dependencies.length = index
            prefixTruncationRevision++

            const controlFault = session.getControlFault()
            if (controlFault.kind === "fault") return
            const error = new SelectorCircularDependencyError(selector, [
                selector,
                ...cyclePath,
            ])
            session.latchCycle(host, selector, error)
            return
        }

        prefixProofVersion = graphVersion
        prefixProofSessionPublications = sessionPublications
    }

    const revalidateAcceptedPrefix = (): void => {
        const graphVersion = host.getSelectorGraphVersion()
        const sessionPublications =
            session.getSelectorGraphPublicationCount(host)
        observedGraphVersion = graphVersion
        observedSessionPublications = sessionPublications
        const onlyAttributed = hasOnlyAttributedPublications(
            prefixProofVersion,
            prefixProofSessionPublications,
            graphVersion,
            sessionPublications,
        )
        if (!onlyAttributed) {
            session.revalidateAncestorPrefixes(host, selector)
        }
        revalidateOwnPrefix(graphVersion, sessionPublications, onlyAttributed)
    }

    session.setPrefixRevalidator(host, selector, revalidateOwnPrefix)

    const suppliedGet = <DependencyValue>(
        dependency: Node,
    ): DependencyValue => {
        if (!suppliedReadActive) throw new SelectorReadRevokedError()

        const priorControlFault = session.getControlFaultForSuppliedRead()
        if (priorControlFault.kind === "fault") {
            throw priorControlFault.error
        }

        const priorCycle = session.getCycle(host, selector)
        if (priorCycle !== undefined) throw priorCycle

        const activePath = session.activeCyclePath(host, dependency)
        if (activePath) {
            const error = new SelectorCircularDependencyError(
                selector,
                activePath,
            )
            session.latchCycle(host, selector, error)
            throw error
        }

        const dependencyIndex = dependencies.length
        let wasAcceptedBeforeServe: boolean
        let wasCurrentDirectDependency = false
        if (dependencyNodes === undefined) {
            const positional = currentDependencies?.[dependencyIndex]
            if (
                positional !== undefined &&
                Object.is(positional.node, dependency)
            ) {
                wasAcceptedBeforeServe = false
                wasCurrentDirectDependency = true
            } else {
                wasAcceptedBeforeServe =
                    materializeDependencyNodes().has(dependency)
            }
        } else {
            wasAcceptedBeforeServe = dependencyNodes.has(dependency)
        }
        if (
            !wasAcceptedBeforeServe &&
            !wasCurrentDirectDependency &&
            currentDependencies !== undefined &&
            currentDependencies.length > 0
        ) {
            const positional = currentDependencies[dependencies.length]
            if (
                positional !== undefined &&
                Object.is(positional.node, dependency)
            ) {
                wasCurrentDirectDependency = true
            } else {
                if (unorderedCurrentDependencyNodes === undefined) {
                    unorderedCurrentDependencyNodes = new Set<Node>()
                    for (const current of currentDependencies) {
                        unorderedCurrentDependencyNodes.add(current.node)
                    }
                }
                wasCurrentDirectDependency =
                    unorderedCurrentDependencyNodes.has(dependency)
            }
        }
        const truncationRevisionBeforeServe = prefixTruncationRevision
        const served = host.serve(dependency, session)

        revalidateAcceptedPrefix()
        const invalidatedPrefixCycle = session.getCycle(host, selector)
        if (invalidatedPrefixCycle !== undefined) {
            throw invalidatedPrefixCycle
        }

        // Serving can synchronously reenter this supplied getter through a
        // lazy host callback, or truncate the accepted prefix after a graph
        // publication. Re-read membership before deciding whether this call
        // must prove and capture the edge.
        const alreadyAccepted =
            dependencyNodes !== undefined
                ? dependencyNodes.has(dependency)
                : prefixTruncationRevision === truncationRevisionBeforeServe &&
                    dependencies.length === dependencyIndex
                  ? false
                  : materializeDependencyNodes().has(dependency)
        const graphVersionAfterServe = observedGraphVersion
        const sessionPublicationsAfterServe = observedSessionPublications
        const mayReusePriorProof =
            alreadyAccepted ||
            (wasCurrentDirectDependency &&
                graphVersionAfterServe === graphVersionAtEntry)
        const maySkipColdParentGraphProof =
            currentDependencies === undefined &&
            hasOnlyAttributedPublications(
                graphVersionAtEntry,
                sessionPublicationsAtEntry,
                graphVersionAfterServe,
                sessionPublicationsAfterServe,
            )
        if (!mayReusePriorProof && !maySkipColdParentGraphProof) {
            requestedNewEdgeProofMemoVersion = graphVersionAfterServe
            if (provideNewEdgeProofMemo === undefined) {
                provideNewEdgeProofMemo = (() =>
                    getNewEdgeProofMemo(
                        requestedNewEdgeProofMemoVersion,
                    )) as SelectorNewEdgeProofMemoProvider<Node>
                provideNewEdgeProofMemo.reverseProofEnabled = true
            }
            const cyclePath = cycleSearch(
                dependency,
                selector,
                host,
                session,
                1,
                dependencies.length,
                provideNewEdgeProofMemo,
            )
            if (cyclePath) {
                const controlFault = session.getControlFault()
                if (controlFault.kind === "fault") throw controlFault.error
                const error = new SelectorCircularDependencyError(selector, [
                    selector,
                    ...cyclePath,
                ])
                session.latchCycle(host, selector, error)
                throw error
            }
        }

        if (!alreadyAccepted) {
            const previousSnapshot =
                currentRecord?.dependencies[dependencies.length]
            dependencyNodes?.add(dependency)
            dependencies.push(
                previousSnapshot !== undefined &&
                    Object.is(previousSnapshot.node, dependency) &&
                    Object.is(previousSnapshot.token, served.token)
                    ? previousSnapshot
                    : Object.freeze({ node: dependency, token: served.token }),
            )
            beginGraphObservation(dependency)
        }
        prefixProofVersion = graphVersionAfterServe
        prefixProofSessionPublications = sessionPublicationsAfterServe

        if (served.outcome.kind === "control-error") {
            session.latchControlFault(served.outcome.error)
            const fault = session.getControlFault()
            if (fault.kind === "fault") throw fault.error
            throw served.outcome.error
        }
        const controlFault = session.getControlFault()
        if (controlFault.kind === "fault") throw controlFault.error
        if (served.outcome.kind === "error") {
            throw new SelectorDependencyError(dependency, served.outcome.error)
        }
        return served.outcome.value as DependencyValue
    }

    try {
        let returned: unknown
        let getterError: unknown | undefined
        let getterThrew = false

        try {
            returned = definition.get(suppliedGet)
        } catch (error) {
            getterThrew = true
            getterError = error
        } finally {
            suppliedReadActive = false
        }

        if (getterThrew) getterError = classifyThrown(getterError, "getter")

        const classifiedResult = getterThrew
            ? undefined
            : classifyReturned(returned, "getter")

        revalidateAcceptedPrefix()

        const controlFault = session.getControlFault()
        if (controlFault.kind === "fault") {
            return makeProposal(
                selector,
                host.createOutcomeToken(),
                { kind: "control-error", error: controlFault.error },
                dependencies,
            )
        }

        const cycleError = session.getCycle(host, selector)
        if (cycleError !== undefined) {
            return makeProposal(
                selector,
                host.createOutcomeToken(),
                { kind: "error", error: cycleError },
                dependencies,
            )
        }

        if (getterThrew) {
            return makeProposal(
                selector,
                host.createOutcomeToken(),
                {
                    kind: "error",
                    error:
                        getterError instanceof
                        InvalidSynchronousSelectorResultError
                            ? getterError
                            : new SelectorGetterError(selector, getterError),
                },
                dependencies,
            )
        }

        if (classifiedResult === undefined) {
            throw new Error("Selector result classification was not completed")
        }

        const postResultControlFault = session.getControlFault()
        if (postResultControlFault.kind === "fault") {
            return makeProposal(
                selector,
                host.createOutcomeToken(),
                {
                    kind: "control-error",
                    error: postResultControlFault.error,
                },
                dependencies,
            )
        }
        if (classifiedResult.kind === "error") {
            return makeProposal(
                selector,
                host.createOutcomeToken(),
                {
                    kind: "error",
                    error:
                        classifiedResult.error instanceof
                        InvalidSynchronousSelectorResultError
                            ? classifiedResult.error
                            : new SelectorGetterError(
                                  selector,
                                  classifiedResult.error,
                              ),
                },
                dependencies,
            )
        }

        let nextValue = classifiedResult.value as Value
        let token: Token | undefined

        if (comparisonBaseline) {
            const compare = definition.equal ?? Object.is
            let comparison: unknown
            let comparisonError: unknown | undefined
            let comparisonThrew = false

            try {
                comparison = compare(comparisonBaseline.value, nextValue)
            } catch (error) {
                comparisonThrew = true
                comparisonError = classifyThrown(error, "comparator")
            }

            const classifiedComparison = comparisonThrew
                ? undefined
                : classifyReturned(comparison, "comparator")

            revalidateAcceptedPrefix()

            const comparatorControlFault = session.getControlFault()
            if (comparatorControlFault.kind === "fault") {
                return makeProposal(
                    selector,
                    host.createOutcomeToken(),
                    {
                        kind: "control-error",
                        error: comparatorControlFault.error,
                    },
                    dependencies,
                )
            }

            const comparatorCycleError = session.getCycle(host, selector)
            if (comparatorCycleError !== undefined) {
                return makeProposal(
                    selector,
                    host.createOutcomeToken(),
                    { kind: "error", error: comparatorCycleError },
                    dependencies,
                )
            }

            if (comparisonThrew) {
                return makeProposal(
                    selector,
                    host.createOutcomeToken(),
                    {
                        kind: "error",
                        error:
                            comparisonError instanceof
                            InvalidSynchronousSelectorResultError
                                ? comparisonError
                                : new SelectorComparatorError(
                                      selector,
                                      comparisonError,
                                  ),
                    },
                    dependencies,
                )
            }

            if (classifiedComparison === undefined) {
                throw new Error(
                    "Selector comparator classification was not completed",
                )
            }

            const postComparatorControlFault = session.getControlFault()
            if (postComparatorControlFault.kind === "fault") {
                return makeProposal(
                    selector,
                    host.createOutcomeToken(),
                    {
                        kind: "control-error",
                        error: postComparatorControlFault.error,
                    },
                    dependencies,
                )
            }
            if (classifiedComparison.kind === "error") {
                return makeProposal(
                    selector,
                    host.createOutcomeToken(),
                    {
                        kind: "error",
                        error:
                            classifiedComparison.error instanceof
                            InvalidSynchronousSelectorResultError
                                ? classifiedComparison.error
                                : new SelectorComparatorError(
                                      selector,
                                      classifiedComparison.error,
                                  ),
                    },
                    dependencies,
                )
            }
            if (
                classifiedComparison.value !== true &&
                classifiedComparison.value !== false
            ) {
                return makeProposal(
                    selector,
                    host.createOutcomeToken(),
                    {
                        kind: "error",
                        error: new InvalidSelectorComparatorResultError(),
                    },
                    dependencies,
                )
            }
            if (classifiedComparison.value === true) {
                nextValue = comparisonBaseline.value
                token = comparisonBaseline.current
                    ? comparisonBaseline.token
                    : undefined
            }
        }

        return makeProposal(
            selector,
            token ?? host.createOutcomeToken(),
            { kind: "value", value: nextValue },
            dependencies,
        )
    } finally {
        try {
            graphObservation?.close()
        } finally {
            session.leave(host, selector)
        }
    }
}
