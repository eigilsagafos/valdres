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

export type SelectorCycleSearchSite = 0 | 1

/** Proposal-local coordinator for fully exhausted negative path proofs. */
export interface SelectorNegativePathMemo<Node> {
    /** False after bounded learning found no reusable closure. */
    readonly enabled: boolean
    /** Starts one physical reachability search. */
    beginSearch(): void
    /** Prunes a node covered by a retained fully-negative closure. */
    hasProvenNoPath(node: Node): boolean
    /** Publishes the search map only after complete negative exhaustion. */
    completeNegative(closure: ReadonlyMap<Node, unknown>): void
}

/**
 * Optional inspectable-Store strategy. Live nodes are valid only for the
 * duration of the call; a recorder must translate them immediately.
 *
 * `negativeMemo`, when supplied, belongs only to one proposal-local prefix
 * revalidation at one exact graph observation. A strategy must call
 * `beginSearch` once, may use `hasProvenNoPath` before expanding each node, and
 * calls `completeNegative` only after the whole search exhausts without a
 * path. It must never publish a partial positive search or carry the memo to
 * another graph observation, prefix batch, or new-edge proof.
 */
export type SelectorCycleSearch<Node, Token extends object> = (
    start: Node,
    target: Node,
    host: SelectorEvaluationHost<Node, Token>,
    session: SelectorEvaluationSession<Node>,
    site: SelectorCycleSearchSite,
    negativeMemo?: SelectorNegativePathMemo<Node>,
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
     * Monotonic version advanced for every selector-graph publication or
     * interleavable record removal/clear.
     */
    getSelectorGraphVersion(): number

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

    latchControlFault(error: unknown): void {
        if (this.#controlFault.kind === "fault") return
        this.#controlFault = Object.freeze({ kind: "fault", error })
    }

    getControlFault(): ControlFault {
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
