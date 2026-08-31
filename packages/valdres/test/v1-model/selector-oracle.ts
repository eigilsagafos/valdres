import type { ValueToken } from "./protocol"

export type SelectorOracleNodeId = string

export type SelectorOracleLeafState =
    | Readonly<{ kind: "value"; value: ValueToken }>
    | Readonly<{ kind: "error"; code: string }>

export type SelectorOracleGetter = (node: SelectorOracleNodeId) => ValueToken

export type SelectorOracleSelector = (get: SelectorOracleGetter) => ValueToken

export type SelectorOracleComparator = (
    previous: ValueToken,
    next: ValueToken,
) => boolean

export type SelectorOracleDefinition =
    | Readonly<{
          kind: "leaf"
          id: SelectorOracleNodeId
          state: SelectorOracleLeafState
      }>
    | Readonly<{
          kind: "selector"
          id: SelectorOracleNodeId
          get: SelectorOracleSelector
          equal?: SelectorOracleComparator
      }>

export type SelectorOracleError =
    | Readonly<{
          kind: "leaf"
          node: SelectorOracleNodeId
          code: string
      }>
    | Readonly<{
          kind: "missing-node"
          node: SelectorOracleNodeId
      }>
    | Readonly<{
          kind: "cycle"
          selector: SelectorOracleNodeId
          dependency: SelectorOracleNodeId
          path: readonly SelectorOracleNodeId[]
      }>
    | Readonly<{
          kind: "dependency"
          selector: SelectorOracleNodeId
          dependency: SelectorOracleNodeId
          cause: SelectorOracleError
      }>
    | Readonly<{
          kind: "getter"
          selector: SelectorOracleNodeId
          thrown: unknown
      }>
    | Readonly<{
          kind: "comparator"
          selector: SelectorOracleNodeId
          thrown: unknown
      }>
    | Readonly<{
          kind: "invalid-comparator-result"
          selector: SelectorOracleNodeId
          result: unknown
      }>

export type SelectorOracleOutcome =
    | Readonly<{ kind: "value"; value: ValueToken }>
    | Readonly<{ kind: "error"; error: SelectorOracleError }>

export interface SelectorOracleEvaluation {
    readonly node: SelectorOracleNodeId
    readonly outcome: SelectorOracleOutcome
    readonly dependencies: readonly SelectorOracleNodeId[]
    readonly canonicalized: boolean
}

export interface SelectorOracleEvaluationOptions {
    /**
     * Existing selector records to serve as already current during this one
     * symbolic campaign. Missing records still recompute. This is an explicit
     * test input, not an implementation of production invalidation.
     */
    readonly current?: readonly SelectorOracleNodeId[]
}

interface SelectorRecord {
    readonly evaluation: SelectorOracleEvaluation
    readonly lastSuccess?: ValueToken
}

interface EvaluationSession {
    readonly active: SelectorOracleNodeId[]
    readonly current: ReadonlySet<SelectorOracleNodeId>
    readonly leafStates: ReadonlyMap<
        SelectorOracleNodeId,
        SelectorOracleLeafState
    >
    readonly memo: Map<SelectorOracleNodeId, SelectorOracleEvaluation>
    readonly stickyCycles: Map<
        SelectorOracleNodeId,
        Extract<SelectorOracleError, { kind: "cycle" }>
    >
    readonly transientDependencies: Map<
        SelectorOracleNodeId,
        readonly SelectorOracleNodeId[]
    >
}

const EMPTY_DEPENDENCIES = Object.freeze([]) as readonly SelectorOracleNodeId[]

const READ_FAILURE = Symbol("selector-oracle-read-failure")

class ReadFailure {
    readonly [READ_FAILURE] = true

    constructor(
        readonly dependency: SelectorOracleNodeId,
        readonly cause: SelectorOracleError,
    ) {}
}

/**
 * A deliberately slow, test-only selector semantics oracle.
 *
 * The oracle uses symbolic IDs and recomputes every reachable selector for
 * every top-level evaluation. It has no production cache-currentness,
 * propagation, lifecycle, Store, transaction, or host machinery. A tiny
 * per-evaluation memo only makes diamond reads deterministic and ensures that
 * a selector callback runs once within one brute-force traversal. Async and
 * thenable containment, runtime-domain faults, served tokens, notification
 * decisions, and host publication modes deliberately remain outside it.
 */
export class SelectorOracle {
    private readonly definitions = new Map<
        SelectorOracleNodeId,
        SelectorOracleDefinition
    >()

    private readonly leafStates = new Map<
        SelectorOracleNodeId,
        SelectorOracleLeafState
    >()

    private readonly records = new Map<SelectorOracleNodeId, SelectorRecord>()

    constructor(definitions: readonly SelectorOracleDefinition[]) {
        for (const definition of definitions) {
            if (definition.id.length === 0) {
                throw new Error("Selector oracle node IDs must not be empty")
            }
            if (this.definitions.has(definition.id)) {
                throw new Error(
                    `Duplicate selector oracle node ID: ${definition.id}`,
                )
            }

            this.definitions.set(definition.id, definition)
            if (definition.kind === "leaf") {
                this.leafStates.set(
                    definition.id,
                    freezeLeafState(definition.state),
                )
            }
        }
    }

    setLeafState(
        id: SelectorOracleNodeId,
        state: SelectorOracleLeafState,
    ): void {
        const definition = this.definitions.get(id)
        if (definition?.kind !== "leaf") {
            throw new Error(`Selector oracle leaf not found: ${id}`)
        }
        this.leafStates.set(id, freezeLeafState(state))
    }

    setLeafValue(id: SelectorOracleNodeId, next: ValueToken): void {
        this.setLeafState(id, { kind: "value", value: next })
    }

    setLeafError(id: SelectorOracleNodeId, code: string): void {
        this.setLeafState(id, { kind: "error", code })
    }

    evaluate(
        id: SelectorOracleNodeId,
        options: SelectorOracleEvaluationOptions = {},
    ): SelectorOracleEvaluation {
        const session: EvaluationSession = {
            active: [],
            current: new Set(options.current),
            leafStates: new Map(this.leafStates),
            memo: new Map(),
            stickyCycles: new Map(),
            transientDependencies: new Map(),
        }
        return this.evaluateNode(id, session)
    }

    record(id: SelectorOracleNodeId): SelectorOracleEvaluation | undefined {
        return this.records.get(id)?.evaluation
    }

    lastSuccessfulValue(id: SelectorOracleNodeId): ValueToken | undefined {
        return this.records.get(id)?.lastSuccess
    }

    private evaluateNode(
        id: SelectorOracleNodeId,
        session: EvaluationSession,
    ): SelectorOracleEvaluation {
        const memoized = session.memo.get(id)
        if (memoized !== undefined) return memoized

        const currentRecord = this.records.get(id)?.evaluation
        if (session.current.has(id) && currentRecord !== undefined) {
            session.memo.set(id, currentRecord)
            return currentRecord
        }

        const definition = this.definitions.get(id)
        if (definition === undefined) {
            const evaluation = freezeEvaluation(id, {
                kind: "error",
                error: Object.freeze({ kind: "missing-node", node: id }),
            })
            session.memo.set(id, evaluation)
            return evaluation
        }

        if (definition.kind === "leaf") {
            const state = session.leafStates.get(id)!
            const outcome: SelectorOracleOutcome =
                state.kind === "value"
                    ? Object.freeze({ kind: "value", value: state.value })
                    : Object.freeze({
                          kind: "error",
                          error: Object.freeze({
                              kind: "leaf",
                              node: id,
                              code: state.code,
                          }),
                      })
            const evaluation = freezeEvaluation(id, outcome)
            session.memo.set(id, evaluation)
            return evaluation
        }

        const dependencies: SelectorOracleNodeId[] = []
        const seenDependencies = new Set<SelectorOracleNodeId>()
        session.active.push(id)
        session.transientDependencies.set(id, dependencies)

        const read: SelectorOracleGetter = dependency => {
            const stickyCycle = session.stickyCycles.get(id)
            if (stickyCycle !== undefined) {
                throw new ReadFailure(stickyCycle.dependency, stickyCycle)
            }

            const activeIndex = session.active.indexOf(dependency)
            if (activeIndex !== -1) {
                const cycle = freezeCycleError(id, dependency, [
                    ...session.active.slice(activeIndex),
                    dependency,
                ])
                session.stickyCycles.set(id, cycle)
                throw new ReadFailure(dependency, cycle)
            }

            const evaluated = this.evaluateNode(dependency, session)
            const pathToOwner = this.findDependencyPath(dependency, id, session)
            if (pathToOwner !== undefined) {
                const cycle = freezeCycleError(id, dependency, [
                    id,
                    ...pathToOwner,
                ])
                session.stickyCycles.set(id, cycle)
                throw new ReadFailure(dependency, cycle)
            }

            if (!seenDependencies.has(dependency)) {
                seenDependencies.add(dependency)
                dependencies.push(dependency)
            }

            if (evaluated.outcome.kind === "error") {
                throw new ReadFailure(dependency, evaluated.outcome.error)
            }
            return evaluated.outcome.value
        }

        let candidate: ValueToken | undefined
        let thrown: unknown
        let didThrow = false
        try {
            candidate = definition.get(read)
        } catch (error) {
            didThrow = true
            thrown = error
        } finally {
            const popped = session.active.pop()
            if (popped !== id) {
                throw new Error("Selector oracle active stack became corrupt")
            }
            session.transientDependencies.delete(id)
        }

        const stickyCycle = session.stickyCycles.get(id)
        let outcome: SelectorOracleOutcome
        let canonicalized = false

        if (stickyCycle !== undefined) {
            outcome = Object.freeze({ kind: "error", error: stickyCycle })
        } else if (didThrow) {
            const error: SelectorOracleError = isReadFailure(thrown)
                ? Object.freeze({
                      kind: "dependency",
                      selector: id,
                      dependency: thrown.dependency,
                      cause: thrown.cause,
                  })
                : Object.freeze({ kind: "getter", selector: id, thrown })
            outcome = Object.freeze({ kind: "error", error })
        } else {
            const compared = this.compareCandidate(
                definition,
                candidate!,
                this.records.get(id)?.lastSuccess,
            )
            outcome = compared.outcome
            canonicalized = compared.canonicalized
        }

        const evaluation = freezeEvaluation(
            id,
            outcome,
            dependencies,
            canonicalized,
        )
        session.memo.set(id, evaluation)

        const previousSuccess = this.records.get(id)?.lastSuccess
        const lastSuccess =
            outcome.kind === "value" ? outcome.value : previousSuccess
        this.records.set(
            id,
            lastSuccess === undefined
                ? { evaluation }
                : { evaluation, lastSuccess },
        )
        return evaluation
    }

    private findDependencyPath(
        from: SelectorOracleNodeId,
        to: SelectorOracleNodeId,
        session: EvaluationSession,
    ): readonly SelectorOracleNodeId[] | undefined {
        const visited = new Set<SelectorOracleNodeId>()

        const visit = (
            node: SelectorOracleNodeId,
        ): readonly SelectorOracleNodeId[] | undefined => {
            if (node === to) return [node]
            if (visited.has(node)) return undefined
            visited.add(node)

            const dependencies =
                session.transientDependencies.get(node) ??
                this.records.get(node)?.evaluation.dependencies ??
                EMPTY_DEPENDENCIES
            for (const dependency of dependencies) {
                const suffix = visit(dependency)
                if (suffix !== undefined) return [node, ...suffix]
            }
            return undefined
        }

        return visit(from)
    }

    private compareCandidate(
        definition: Extract<SelectorOracleDefinition, { kind: "selector" }>,
        candidate: ValueToken,
        previous: ValueToken | undefined,
    ): Readonly<{
        outcome: SelectorOracleOutcome
        canonicalized: boolean
    }> {
        if (previous === undefined) {
            return {
                outcome: Object.freeze({ kind: "value", value: candidate }),
                canonicalized: false,
            }
        }

        let comparison: unknown
        try {
            comparison = (definition.equal ?? selectorTokenObjectIs)(
                previous,
                candidate,
            )
        } catch (thrown) {
            const error: SelectorOracleError = Object.freeze({
                kind: "comparator",
                selector: definition.id,
                thrown,
            })
            return {
                outcome: Object.freeze({
                    kind: "error",
                    error,
                }),
                canonicalized: false,
            }
        }

        if (comparison !== true && comparison !== false) {
            const error: SelectorOracleError = Object.freeze({
                kind: "invalid-comparator-result",
                selector: definition.id,
                result: comparison,
            })
            return {
                outcome: Object.freeze({
                    kind: "error",
                    error,
                }),
                canonicalized: false,
            }
        }

        return {
            outcome: Object.freeze({
                kind: "value",
                value: comparison ? previous : candidate,
            }),
            canonicalized: comparison,
        }
    }
}

export function createSelectorOracle(
    definitions: readonly SelectorOracleDefinition[],
): SelectorOracle {
    return new SelectorOracle(definitions)
}

/** Symbolic equivalent of JavaScript `Object.is` for the model's ValueToken. */
export function selectorTokenObjectIs(
    left: ValueToken,
    right: ValueToken,
): boolean {
    if (left.kind !== right.kind) return false

    switch (left.kind) {
        case "undefined":
        case "null":
            return true
        case "boolean":
        case "string":
        case "bigint":
            return left.value === (right as typeof left).value
        case "number":
            return Object.is(left.value, (right as typeof left).value)
        case "identity": {
            const other = right as typeof left
            return (
                left.identityKind === other.identityKind && left.id === other.id
            )
        }
    }
}

function isReadFailure(candidate: unknown): candidate is ReadFailure {
    return (
        typeof candidate === "object" &&
        candidate !== null &&
        READ_FAILURE in candidate &&
        (candidate as ReadFailure)[READ_FAILURE] === true
    )
}

function freezeLeafState(
    state: SelectorOracleLeafState,
): SelectorOracleLeafState {
    return state.kind === "value"
        ? Object.freeze({ kind: "value", value: state.value })
        : Object.freeze({ kind: "error", code: state.code })
}

function freezeCycleError(
    selector: SelectorOracleNodeId,
    dependency: SelectorOracleNodeId,
    path: readonly SelectorOracleNodeId[],
): Extract<SelectorOracleError, { kind: "cycle" }> {
    return Object.freeze({
        kind: "cycle",
        selector,
        dependency,
        path: Object.freeze([...path]),
    })
}

function freezeEvaluation(
    node: SelectorOracleNodeId,
    outcome: SelectorOracleOutcome,
    dependencies: readonly SelectorOracleNodeId[] = EMPTY_DEPENDENCIES,
    canonicalized = false,
): SelectorOracleEvaluation {
    return Object.freeze({
        node,
        outcome,
        dependencies:
            dependencies === EMPTY_DEPENDENCIES
                ? EMPTY_DEPENDENCIES
                : Object.freeze([...dependencies]),
        canonicalized,
    })
}
