export type SelectorRead<Node> = <Value>(node: Node) => Value

export interface SelectorDefinition<Node, Value = unknown> {
    readonly node: Node
    readonly get: (get: SelectorRead<Node>) => Value
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

    /** Current authoritative forward graph for an inactive selector. */
    getSelectorRecord(node: Node): SelectorRecordView<Node, Token> | undefined

    /** Host-selected prior successful comparison baseline, if one exists. */
    getComparisonBaseline(
        node: Node,
    ): SelectorComparisonBaseline<Token, unknown> | undefined

    /** Allocate one host-local served-outcome identity. */
    createOutcomeToken(): Token
}

interface ActiveSelectorFrame<Node> {
    readonly selector: Node
    readonly acceptedDependencies: Node[]
    readonly acceptedDependencySet: Set<Node>
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
    #controlFault: ControlFault = NO_CONTROL_FAULT

    latchControlFault(error: unknown): void {
        if (this.#controlFault.kind === "fault") return
        this.#controlFault = Object.freeze({ kind: "fault", error })
    }

    getControlFault(): ControlFault {
        return this.#controlFault
    }

    /** @internal Evaluator-owned frame admission. */
    enter(selector: Node): void {
        this.#frames.push({
            selector,
            acceptedDependencies: [],
            acceptedDependencySet: new Set(),
            cycleError: undefined,
        })
    }

    /** @internal Evaluator-owned frame release. */
    leave(selector: Node): void {
        const frame = this.#frames.pop()
        if (!frame || !Object.is(frame.selector, selector)) {
            throw new Error("Selector evaluation frame corruption")
        }
    }

    /** @internal */
    isActive(node: Node): boolean {
        return this.#frames.some(frame => Object.is(frame.selector, node))
    }

    /** @internal */
    activeCyclePath(node: Node): readonly Node[] | undefined {
        const index = this.#frames.findIndex(frame =>
            Object.is(frame.selector, node),
        )
        if (index === -1) return undefined
        return Object.freeze([
            ...this.#frames.slice(index).map(frame => frame.selector),
            node,
        ])
    }

    /** @internal */
    acceptDependency(selector: Node, dependency: Node): void {
        const frame = this.#currentFrame(selector)
        if (!frame.acceptedDependencySet.has(dependency)) {
            frame.acceptedDependencySet.add(dependency)
            frame.acceptedDependencies.push(dependency)
        }
    }

    /** @internal */
    getAcceptedDependencies(selector: Node): readonly Node[] {
        return this.#currentFrame(selector).acceptedDependencies
    }

    /** @internal */
    getTransientDependencies(node: Node): readonly Node[] | undefined {
        const frame = this.#frames.find(candidate =>
            Object.is(candidate.selector, node),
        )
        return frame?.acceptedDependencies
    }

    /** @internal */
    latchCycle(selector: Node, error: unknown): void {
        const frame = this.#currentFrame(selector)
        frame.cycleError ??= error
    }

    /** @internal */
    getCycle(selector: Node): unknown | undefined {
        return this.#currentFrame(selector).cycleError
    }

    #currentFrame(selector: Node): ActiveSelectorFrame<Node> {
        const frame = this.#frames[this.#frames.length - 1]
        if (!frame || !Object.is(frame.selector, selector)) {
            throw new Error("Selector evaluation frame is not active")
        }
        return frame
    }
}

type ControlFault =
    | Readonly<{ kind: "none" }>
    | Readonly<{ kind: "fault"; error: unknown }>

const NO_CONTROL_FAULT = Object.freeze({ kind: "none" as const })
