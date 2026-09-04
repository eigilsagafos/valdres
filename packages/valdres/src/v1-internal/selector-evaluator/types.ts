export type SelectorRead<Node> = <Value>(node: Node) => Value

export interface SelectorDefinition<Node, Value = unknown> {
    readonly node: Node
    readonly get: (get: SelectorRead<Node>) => Value
    readonly name?: string
    readonly equal?: (previous: Value, next: Value) => boolean
}

export type SelectorOutcome<Value = unknown> =
    | Readonly<{ kind: "value"; value: Value }>
    | Readonly<{ kind: "error"; error: unknown }>
    | Readonly<{ kind: "control-error"; error: unknown }>

export interface ServedSelectorOutcome<Token extends object, Value = unknown> {
    readonly token: Token
    readonly outcome: SelectorOutcome<Value>
}

export interface SelectorDependencySnapshot<Node, Token extends object> {
    readonly node: Node
    readonly token: Token
}

/**
 * The last successful value is comparison-only state. A host supplies a
 * canonical token only while that successful value is also the currently
 * served outcome. An error -> equal last-good recovery therefore receives a
 * new token and remains observable.
 */
export type SelectorComparisonBaseline<Token extends object, Value = unknown> =
    | Readonly<{ current: false; value: Value }>
    | Readonly<{ current: true; value: Value; token: Token }>

export interface SelectorRecordView<Node, Token extends object> {
    readonly dependencies: readonly SelectorDependencySnapshot<Node, Token>[]
}

export interface SelectorGraphEdgeAddition<Node> {
    readonly tail: Node
    readonly head: Node
}

/** @internal Outcome of one bounded active-prefix reverse snapshot attempt. */
export type SelectorTopologyDeltaReverseSnapshotOutcome =
    | "completed"
    | "overflow"
    | "unavailable"

/** @internal Inspection-only observation of reverse snapshot construction. */
export interface SelectorTopologyDeltaReverseSnapshotDiagnostics {
    recordSnapshot(
        outcome: SelectorTopologyDeltaReverseSnapshotOutcome,
        scannedFrames: number,
        activeFrames: number,
        prefixEdges: number,
    ): void
}

/**
 * Evaluation-local reverse overlay for one exact topology-delta replay batch.
 * The snapshot contributes active transient-prefix edges that are absent from
 * committed reverse adjacency. Its mutable gate bounds repeated misses without
 * retaining any evidence beyond the synchronous replay. An absent snapshot
 * keeps only sole-active-target proofs eligible and otherwise fails closed.
 */
export interface SelectorTopologyDeltaReverseProofContext<Node> {
    readonly transientDependents: ReadonlyMap<Node, readonly Node[]> | undefined
    reverseProofEnabled: boolean
}

/**
 * Synchronous, bounded observation of exact selector-edge additions. An
 * undefined read means the host could not retain a complete interval and the
 * evaluator must use its canonical accepted-prefix proof instead.
 */
export interface SelectorGraphObservation<Node> {
    takeAddedEdges(): readonly SelectorGraphEdgeAddition<Node>[] | undefined
    close(): void
}

/** @internal Mutable budget shared with one bounded selector-graph traversal. */
export interface SelectorGraphTraversalBudget {
    remaining: number
}

export type SelectorProposalOutcome<Value = unknown> = SelectorOutcome<Value>

export interface SelectorEvaluationProposal<
    Node,
    Token extends object,
    Value = unknown,
> {
    readonly selector: Node
    readonly token: Token
    readonly outcome: SelectorProposalOutcome<Value>
    /** Complete first-read-ordered, deduplicated direct dependency capture. */
    readonly dependencies: readonly SelectorDependencySnapshot<Node, Token>[]
    /** Failure-only accepted acyclic prefix; the offending/foreign edge is absent. */
    readonly attemptedPrefix: readonly Node[]
}

export type SelectorCycleSearchSite = 0 | 1 | 2

/** @internal Inspection-only aggregate classification for one site-1 proof. */
export type SelectorNewEdgeProofMemoSearchClassification =
    | "observing"
    | "consulted-no-prune"
    | "consulted-pruned"

/** @internal A bounded negative closure retained by one site-1 proof. */
export type SelectorNewEdgeProofMemoSeedReason =
    | "initial"
    | "activation-replacement"
    | "secondary"
    | "hit-derived"

/** @internal A site-1 proof-sharing coordinator stopped for this version. */
export type SelectorNewEdgeProofMemoDisableReason =
    | "miss-budget"
    | "over-cap-hit"
    | "passive-probe-budget"

/**
 * Optional evaluation-local diagnostics sink. Ordinary evaluation omits it;
 * inspectable evaluation aggregates into its enclosing summaries.
 */
export interface SelectorNewEdgeProofDiagnostics {
    admissionSkipped(): void
    disabled(): void
    graphVersionReset(): void
    /** Adds non-search membership checks used to validate a retained proof. */
    recordMapProbes?(count: number): void
    completeSearch(
        classification: SelectorNewEdgeProofMemoSearchClassification,
        seed?: SelectorNewEdgeProofMemoSeedReason,
        disable?: SelectorNewEdgeProofMemoDisableReason,
        mapProbes?: number,
        prunedNodes?: number,
        retainedNodes?: number,
    ): void
}

/**
 * Evaluation-local coordinator for fully exhausted negative site-1 proofs.
 *
 * A search may consult retained closures only when `beginSearch` returns true,
 * and may publish its parent map only after exhausting without finding the
 * target. The evaluator owns the coordinator's target, host, and synchronous
 * graph-observation lifetime; strategies must not retain it or use it at
 * another site.
 */
export interface SelectorNewEdgeProofMemo<Node> {
    /** False after bounded admission found no reusable overlap. */
    readonly enabled: boolean
    /** Starts one physical search and reports whether anchors are available. */
    beginSearch(): boolean
    /** Prunes a node covered by a retained fully-negative closure. */
    hasProvenNoPath(node: Node): boolean
    /**
     * Inspection-only equivalent that also updates aggregate probe counters.
     * The ordinary evaluator deliberately uses the unmeasured method so its
     * DFS inner loop does not pay a diagnostics branch.
     */
    hasProvenNoPathMeasured(node: Node): boolean
    /** Publishes a closure only after complete negative exhaustion. */
    completeNegative(closure: ReadonlyMap<Node, unknown>): void
    /** Completes a physical search that found its target and retained nothing. */
    completePositive(): void
}

/** @internal Evaluation-local site-1 acceleration state. */
export interface SelectorNewEdgeProofMemoProvider<Node> {
    /** Lazily acquired only when a site-1 proof falls back to forward DFS. */
    (): SelectorNewEdgeProofMemo<Node> | undefined
    /** A bounded reverse traversal disables itself after its first budget miss. */
    reverseProofEnabled: boolean
}

/**
 * Optional inspectable-Store strategy. Live nodes are valid only for the
 * duration of the call; a recorder must translate them immediately.
 *
 * Site 0 is the canonical accepted-prefix proof, site 1 is a newly proposed
 * edge proof, and site 2 is a negative-only replay of an exact committed edge
 * addition. A positive site-2 result must fall back to site 0 so first-read
 * blame and the canonical cycle path remain unchanged. The memo provider is
 * supplied only at site 1 and is invoked only when a bounded host acceleration
 * cannot prove the negative first. Its evidence remains evaluation-local and
 * may cross a graph version only when one exact addition interval preserves a
 * fully exhausted, successor-closed negative proof. The topology-delta reverse
 * context is supplied only at site 2 and is shared by one exact replay batch.
 */
export type SelectorCycleSearch<Node, Token extends object> = (
    start: Node,
    target: Node,
    host: SelectorEvaluationHost<Node, Token>,
    session: SelectorEvaluationSession<Node>,
    site: SelectorCycleSearchSite,
    /** Length of the active selector prefix whose acyclicity this proves. */
    acceptedPrefixLength: number,
    getNewEdgeProofMemo?: SelectorNewEdgeProofMemoProvider<Node>,
    topologyDeltaReverseProof?: SelectorTopologyDeltaReverseProofContext<Node>,
) => readonly Node[] | undefined

export interface SelectorEvaluationStrategy {
    <Node, Token extends object, Value>(
        definition: SelectorDefinition<Node, Value>,
        host: SelectorEvaluationHost<Node, Token>,
        session: SelectorEvaluationSession<Node>,
    ): SelectorEvaluationProposal<Node, Token, Value>
}

export interface SelectorEvaluationHost<Node, Token extends object> {
    /**
     * Make one dependency current. Value and ordinary-error outcomes are
     * returned. The only permitted throw is an exact control fault already
     * latched in this session.
     */
    serve(
        node: Node,
        session: SelectorEvaluationSession<Node>,
    ): ServedSelectorOutcome<Token, unknown>

    /**
     * Current authoritative forward graph for an inactive selector. For a
     * selector node, absence is graph-closed: no authoritative selector record
     * may point to that absent node.
     */
    getSelectorRecord(node: Node): SelectorRecordView<Node, Token> | undefined

    /**
     * Optional selector-only adjacency lookup used exclusively by closure
     * proofs. When implemented, `undefined` identifies a terminal node rather
     * than requesting fallback to `getSelectorRecord`.
     */
    getSelectorDependencyNodes?(node: Node): readonly Node[] | undefined

    /**
     * Optional committed-host reverse adjacency. It must synchronously expose
     * every authoritative committed selector that directly depends on `node`.
     * The host must decrement `budget.remaining` once for every underlying
     * route reference it probes, including dead weak references, and stop when
     * either the budget or the visitor asks it to. Returns true only after
     * exhausting the adjacency.
     */
    visitSelectorDependents?(
        node: Node,
        budget: SelectorGraphTraversalBudget,
        visitor: (dependent: Node) => boolean,
    ): boolean

    /**
     * Monotonic version advanced for every selector-graph publication or
     * interleavable record removal/clear.
     */
    getSelectorGraphVersion(): number

    /**
     * Optional committed-host acceleration. Direct node references live only
     * while at least one synchronous evaluator is observing the host. Returning
     * `undefined` certifies that the passed dependency's identity cannot act as
     * a selector-graph tail for the duration of this evaluation; the evaluator
     * retries when it accepts a later dependency that can participate in the
     * selector graph.
     */
    beginSelectorGraphObservation?(
        newlyAcceptedDependency: Node,
    ): SelectorGraphObservation<Node> | undefined

    /** Host-selected prior successful comparison baseline, if one exists. */
    getComparisonBaseline(
        node: Node,
    ): SelectorComparisonBaseline<Token, unknown> | undefined

    /** Allocate one host-local served-outcome identity. */
    createOutcomeToken(): Token
}

interface ActiveSelectorFrame<Node> {
    readonly host: object
    readonly selector: Node
    readonly dependencyPrefix: readonly Readonly<{ node: Node }>[]
    revalidatePrefix: (() => void) | undefined
    cycleError: unknown | undefined
}

/**
 * One top-level synchronous evaluation session shared by recursive selectors.
 * A future runtime-domain callback guard latches recognized control faults here
 * before throwing them. The first exact fault wins even when user code catches
 * the synchronous throw.
 */
export class SelectorEvaluationSession<Node> {
    readonly #frames: ActiveSelectorFrame<Node>[] = []
    #selectorGraphPublicationHost: object | undefined
    #selectorGraphPublicationCount = 0
    #otherSelectorGraphPublications: WeakMap<object, number> | undefined
    #controlFault: ControlFault = NO_CONTROL_FAULT
    #suppliedReadGuard: (() => never) | undefined

    latchControlFault(error: unknown): void {
        if (this.#controlFault.kind === "fault") return
        this.#controlFault = Object.freeze({ kind: "fault", error })
    }

    getControlFault(): ControlFault {
        return this.#controlFault
    }

    /** @internal Temporarily replace the guard run before a selector-supplied
     * getter observes evaluator or host state. */
    setSuppliedReadGuard(
        guard: (() => never) | undefined,
    ): (() => never) | undefined {
        const previous = this.#suppliedReadGuard
        this.#suppliedReadGuard = guard
        return previous
    }

    /** @internal Enforce any active callback-capability boundary before
     * returning the first sticky evaluator fault. */
    getControlFaultForSuppliedRead(): ControlFault {
        this.#suppliedReadGuard?.()
        return this.#controlFault
    }

    /** @internal Host-owned publication attribution for this exact session. */
    noteSelectorGraphPublication(host: object): void {
        const firstHost = this.#selectorGraphPublicationHost
        if (firstHost === undefined) {
            this.#selectorGraphPublicationHost = host
            this.#selectorGraphPublicationCount = 1
            return
        }
        if (Object.is(firstHost, host)) {
            this.#selectorGraphPublicationCount++
            return
        }
        const others =
            this.#otherSelectorGraphPublications ??
            (this.#otherSelectorGraphPublications = new WeakMap())
        others.set(host, (others.get(host) ?? 0) + 1)
    }

    /** @internal Evaluator-owned host-local publication observation. */
    getSelectorGraphPublicationCount(host: object): number {
        return Object.is(this.#selectorGraphPublicationHost, host)
            ? this.#selectorGraphPublicationCount
            : (this.#otherSelectorGraphPublications?.get(host) ?? 0)
    }

    /** @internal Evaluator-owned frame admission. */
    enter(
        host: object,
        selector: Node,
        dependencyPrefix: readonly Readonly<{ node: Node }>[],
    ): void {
        this.#frames.push({
            host,
            selector,
            dependencyPrefix,
            revalidatePrefix: undefined,
            cycleError: undefined,
        })
    }

    /** @internal Evaluator-owned frame release. */
    leave(host: object, selector: Node): void {
        const frame = this.#frames.pop()
        if (
            !frame ||
            !Object.is(frame.host, host) ||
            !Object.is(frame.selector, selector)
        ) {
            throw new Error("Selector evaluation frame corruption")
        }
    }

    /** @internal */
    isActive(host: object, node: Node): boolean {
        return this.#frames.some(
            frame =>
                Object.is(frame.host, host) && Object.is(frame.selector, node),
        )
    }

    /** @internal True when this selector is the host's only active frame. */
    isSoleActiveSelector(host: object, selector: Node): boolean {
        let found = false
        for (const frame of this.#frames) {
            if (!Object.is(frame.host, host)) continue
            if (found || !Object.is(frame.selector, selector)) return false
            found = true
        }
        return found
    }

    /** @internal */
    activeCyclePath(host: object, node: Node): readonly Node[] | undefined {
        const index = this.#frames.findIndex(
            frame =>
                Object.is(frame.host, host) && Object.is(frame.selector, node),
        )
        if (index === -1) return undefined
        return Object.freeze([
            ...this.#frames
                .slice(index)
                .filter(frame => Object.is(frame.host, host))
                .map(frame => frame.selector),
            node,
        ])
    }

    /** @internal Evaluator-owned active-frame coordination. */
    setPrefixRevalidator(
        host: object,
        selector: Node,
        revalidate: () => void,
    ): void {
        const frame = this.#currentFrame(host, selector)
        if (frame.revalidatePrefix !== undefined) {
            throw new Error("Selector prefix revalidator is already installed")
        }
        frame.revalidatePrefix = revalidate
    }

    /** @internal Revalidate outer frames before a nested proof. */
    revalidateAncestorPrefixes(host: object, selector: Node): void {
        this.#currentFrame(host, selector)
        for (let index = 0; index < this.#frames.length - 1; index++) {
            const frame = this.#frames[index]!
            if (!Object.is(frame.host, host)) continue
            const revalidate = frame.revalidatePrefix
            if (revalidate === undefined) {
                throw new Error("Selector prefix revalidator is not installed")
            }
            revalidate()
        }
    }

    /** @internal */
    getTransientDependencies(
        host: object,
        node: Node,
    ): readonly Readonly<{ node: Node }>[] | undefined {
        for (let index = this.#frames.length - 1; index >= 0; index--) {
            const frame = this.#frames[index]!
            if (
                Object.is(frame.host, host) &&
                Object.is(frame.selector, node)
            ) {
                return frame.dependencyPrefix
            }
        }
        return undefined
    }

    /**
     * Snapshot every active same-host transient prefix as reverse additions.
     * Committed reverse edges are deliberately not subtracted: stale edges can
     * only force canonical fallback from a negative-only reverse certificate.
     * Any frame ambiguity, caller mismatch, or oversized snapshot fails closed.
     */
    captureTransientReverseDependents(
        host: object,
        selector: Node,
        acceptedPrefixLength: number,
        maxEntries: number,
        diagnostics?: SelectorTopologyDeltaReverseSnapshotDiagnostics,
    ): ReadonlyMap<Node, readonly Node[]> | undefined {
        const seenSelectors = new Set<Node>()
        const mutable = new Map<Node, Node[]>()
        let matchedSelector = false
        let scannedFrames = 0
        let activeFrames = 0
        let edgeCount = 0

        for (const frame of this.#frames) {
            scannedFrames++
            if (scannedFrames > maxEntries) {
                diagnostics?.recordSnapshot(
                    "overflow",
                    scannedFrames,
                    activeFrames,
                    edgeCount,
                )
                return undefined
            }
            if (!Object.is(frame.host, host)) continue
            activeFrames++
            if (
                frame.revalidatePrefix === undefined ||
                seenSelectors.has(frame.selector)
            ) {
                diagnostics?.recordSnapshot(
                    "unavailable",
                    scannedFrames,
                    activeFrames,
                    edgeCount,
                )
                return undefined
            }
            seenSelectors.add(frame.selector)
            if (Object.is(frame.selector, selector)) {
                if (
                    matchedSelector ||
                    frame.dependencyPrefix.length !== acceptedPrefixLength
                ) {
                    diagnostics?.recordSnapshot(
                        "unavailable",
                        scannedFrames,
                        activeFrames,
                        edgeCount,
                    )
                    return undefined
                }
                matchedSelector = true
            }
            for (const dependency of frame.dependencyPrefix) {
                edgeCount++
                if (edgeCount > maxEntries) {
                    diagnostics?.recordSnapshot(
                        "overflow",
                        scannedFrames,
                        activeFrames,
                        edgeCount,
                    )
                    return undefined
                }
                const dependents = mutable.get(dependency.node)
                if (dependents === undefined) {
                    mutable.set(dependency.node, [frame.selector])
                } else {
                    dependents.push(frame.selector)
                }
            }
        }

        if (!matchedSelector) {
            diagnostics?.recordSnapshot(
                "unavailable",
                scannedFrames,
                activeFrames,
                edgeCount,
            )
            return undefined
        }
        const snapshot = new Map<Node, readonly Node[]>()
        for (const [dependency, dependents] of mutable) {
            snapshot.set(dependency, Object.freeze(dependents))
        }
        diagnostics?.recordSnapshot(
            "completed",
            scannedFrames,
            activeFrames,
            edgeCount,
        )
        return snapshot
    }

    /** @internal */
    latchCycle(host: object, selector: Node, error: unknown): void {
        const frame = this.#activeFrame(host, selector)
        frame.cycleError ??= error
    }

    /** @internal */
    getCycle(host: object, selector: Node): unknown | undefined {
        return this.#currentFrame(host, selector).cycleError
    }

    #currentFrame(host: object, selector: Node): ActiveSelectorFrame<Node> {
        const frame = this.#frames[this.#frames.length - 1]
        if (
            !frame ||
            !Object.is(frame.host, host) ||
            !Object.is(frame.selector, selector)
        ) {
            throw new Error("Selector evaluation frame is not active")
        }
        return frame
    }

    #activeFrame(host: object, selector: Node): ActiveSelectorFrame<Node> {
        for (let index = this.#frames.length - 1; index >= 0; index--) {
            const frame = this.#frames[index]!
            if (
                Object.is(frame.host, host) &&
                Object.is(frame.selector, selector)
            ) {
                return frame
            }
        }
        throw new Error("Selector evaluation frame is not active")
    }
}

type ControlFault =
    | Readonly<{ kind: "none" }>
    | Readonly<{ kind: "fault"; error: unknown }>

const NO_CONTROL_FAULT = Object.freeze({ kind: "none" as const })
