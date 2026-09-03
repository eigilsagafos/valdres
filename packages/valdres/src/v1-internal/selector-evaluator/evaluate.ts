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
    SelectorEvaluationHost,
    SelectorEvaluationProposal,
    SelectorEvaluationSession,
    SelectorNewEdgeProofMemo,
    SelectorOutcome,
    SelectorCycleSearch,
    SelectorCycleSearchSite,
    SelectorGraphObservation,
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

interface ResettableNewEdgeProofMemo<Node>
    extends SelectorNewEdgeProofMemo<Node> {
    reset(): void
}

const createNewEdgeProofMemo = <Node>(): ResettableNewEdgeProofMemo<Node> => {
    let first: ReadonlyMap<Node, unknown> | undefined
    let second: ReadonlyMap<Node, unknown> | undefined
    let hits = 0
    let missWork = 0
    let locked = false
    let enabled = true

    const disable = (): void => {
        first = undefined
        second = undefined
        missWork = 0
        enabled = false
    }

    const reset = (): void => {
        first = undefined
        second = undefined
        hits = 0
        missWork = 0
        locked = false
        enabled = true
    }

    return {
        get enabled() {
            return enabled
        },
        beginSearch() {
            hits = 0
            return enabled && first !== undefined
        },
        hasProvenNoPath(node) {
            if (first?.has(node)) {
                hits |= 1
                return true
            }
            if (second?.has(node)) {
                hits |= 2
                return true
            }
            return false
        },
        completeNegative(closure) {
            if (!enabled) return
            if (hits !== 0) {
                // A broad approach that only touches a much smaller retained
                // tail is not useful evidence to keep probing. It cannot be
                // retained within the liveness bound, so disable rather than
                // resetting the miss budget on every repeated broad walk.
                if (closure.size > NEW_EDGE_MEMO_MAX_ANCHOR_SIZE) {
                    disable()
                    return
                }
                // A search that pruned a certified-negative anchor is itself
                // a complete negative certificate. Keep its new approach path
                // as well as the broadest prior layer, without copying either
                // existing DFS map. This is what lets one shared-tail hit teach
                // later roots to stop before walking that tail again.
                const priorFirst = first
                const priorSecond = second
                first = undefined
                second = undefined
                const retain = (
                    candidate: ReadonlyMap<Node, unknown> | undefined,
                ): void => {
                    if (
                        candidate === undefined ||
                        candidate.size > NEW_EDGE_MEMO_MAX_ANCHOR_SIZE ||
                        candidate === first
                    ) {
                        return
                    }
                    if (first === undefined || candidate.size > first.size) {
                        second = first
                        first = candidate
                    } else if (
                        second === undefined ||
                        candidate.size > second.size
                    ) {
                        second = candidate
                    }
                }
                retain(priorFirst)
                retain(priorSecond)
                retain(closure)
                locked = true
                missWork = 0
                return
            }
            // Terminal roots never perform a Map lookup and do not count as
            // evidence against overlap: a useful shared selector layer may
            // appear after a run of source dependencies.
            if (closure.size === 1) return
            const mayRetain =
                closure.size >= NEW_EDGE_MEMO_MIN_SEED_SIZE &&
                closure.size <= NEW_EDGE_MEMO_MAX_ANCHOR_SIZE
            if (first === undefined) {
                if (mayRetain) first = closure
                return
            }

            const missCost = Math.min(closure.size, NEW_EDGE_MEMO_MIN_SEED_SIZE)
            missWork += missCost
            if (!locked && second === undefined && mayRetain) {
                // Give a second substantial closure one following proof to
                // demonstrate overlap, even when admitting it crosses the
                // cumulative miss budget.
                second = closure
                return
            }
            if (missWork >= NEW_EDGE_MEMO_MAX_MISS_WORK) {
                disable()
            }
        },
        reset,
    }
}

const findDependencyPathFast = <Node, Token extends object>(
    start: Node,
    target: Node,
    host: SelectorEvaluationHost<Node, Token>,
    session: SelectorEvaluationSession<Node>,
    _site: SelectorCycleSearchSite,
    _acceptedPrefixLength: number,
    newEdgeProofMemo?: SelectorNewEdgeProofMemo<Node>,
): readonly Node[] | undefined => {
    const consultMemo = newEdgeProofMemo?.beginSearch() ?? false
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
            return Object.freeze(reversed)
        }
        const transient = session.getTransientDependencies(host, node)
        if (transient) {
            if (transient.length === 0) continue
            if (consultMemo && newEdgeProofMemo!.hasProvenNoPath(node)) {
                continue
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
            if (consultMemo && newEdgeProofMemo!.hasProvenNoPath(node)) {
                continue
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
        if (consultMemo && newEdgeProofMemo!.hasProvenNoPath(node)) continue
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
    let newEdgeProofsAtVersion = 0
    let newEdgeProofMemo: ResettableNewEdgeProofMemo<Node> | undefined

    const getNewEdgeProofMemo = (
        graphVersion: number,
    ): SelectorNewEdgeProofMemo<Node> | undefined => {
        if (graphVersion !== newEdgeProofMemoVersion) {
            newEdgeProofMemoVersion = graphVersion
            newEdgeProofsAtVersion = 0
            newEdgeProofMemo?.reset()
        }
        newEdgeProofsAtVersion++
        // Warm wide parents can learn from their first retained-edge re-proof.
        // A cold or narrow proposal waits for three proofs at one exact graph
        // version, avoiding allocation on singleton and graph-churning paths.
        if (
            (currentDependencies?.length ?? 0) < 3 &&
            newEdgeProofsAtVersion < 3
        ) {
            return undefined
        }
        if (newEdgeProofMemo === undefined) {
            newEdgeProofMemo = createNewEdgeProofMemo<Node>()
        }
        return newEdgeProofMemo.enabled ? newEdgeProofMemo : undefined
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
            prefixProofVersion = graphVersion
            prefixProofSessionPublications = sessionPublications
            return
        }
        const addedEdges = graphObservation?.takeAddedEdges()
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

        const priorControlFault = session.getControlFault()
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
            const cyclePath = cycleSearch(
                dependency,
                selector,
                host,
                session,
                1,
                dependencies.length,
                getNewEdgeProofMemo(graphVersionAfterServe),
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
