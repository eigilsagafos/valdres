import {
    InvalidSelectorComparatorResultError,
    InvalidSynchronousSelectorResultError,
    SelectorCircularDependencyError,
    SelectorComparatorError,
    SelectorDependencyError,
    SelectorGetterError,
    SelectorReadRevokedError,
} from "../selector-evaluator/errors"
import type {
    SelectorDefinition,
    SelectorDependencySnapshot,
    SelectorEvaluationHost,
    SelectorEvaluationProposal,
    SelectorEvaluationSession,
    SelectorOutcome,
} from "../selector-evaluator/types"

// Candidate-owned synchronous result boundary. No incumbent evaluator is called.
function synchronous(value: unknown, phase: "getter" | "comparator"): unknown {
    if (
        (typeof value !== "object" || value === null) &&
        typeof value !== "function"
    )
        return value
    const then = (value as { then?: unknown }).then
    if (typeof then !== "function") return value
    try {
        Reflect.apply(then, value, [undefined, () => {}])
    } catch {
        // Rejection containment cannot replace the named synchronous failure.
    }
    throw new InvalidSynchronousSelectorResultError(phase)
}

// Iterative ordered closure over the current effective graph. Active records
// substitute their accepted prefixes; the rejected edge never enters a record.
function returnPath<Node, Token extends object>(
    start: Node,
    target: Node,
    host: SelectorEvaluationHost<Node, Token>,
    session: SelectorEvaluationSession<Node>,
): Node[] | undefined {
    const parents = new Map<Node, Node>()
    const pending = [start]
    parents.set(start, start)
    while (pending.length > 0) {
        const node = pending.pop()!
        if (Object.is(node, target)) {
            const path = [node]
            while (!Object.is(path[path.length - 1], start)) {
                path.push(parents.get(path[path.length - 1]!)!)
            }
            return path.reverse()
        }
        const transient = session.getTransientDependencies(host, node)
        if (transient !== undefined) {
            for (let i = transient.length - 1; i >= 0; i--) {
                const next = transient[i]!.node
                if (parents.has(next)) continue
                parents.set(next, node)
                pending.push(next)
            }
            continue
        }
        // Atoms have no outgoing edges: the committed host's selector-only
        // adjacency reaches every selector the full record reaches.
        const selectorEdges = host.getSelectorDependencyNodes?.(node)
        if (selectorEdges !== undefined) {
            for (let i = selectorEdges.length - 1; i >= 0; i--) {
                const next = selectorEdges[i]!
                if (parents.has(next)) continue
                parents.set(next, node)
                pending.push(next)
            }
            continue
        }
        if (host.getSelectorDependencyNodes !== undefined) continue
        const edges = host.getSelectorRecord(node)?.dependencies
        if (edges === undefined) continue
        for (let i = edges.length - 1; i >= 0; i--) {
            const next = edges[i]!.node
            if (parents.has(next)) continue
            parents.set(next, node)
            pending.push(next)
        }
    }
    return undefined
}

/** The reactive candidate's independent evaluation transaction. */
export function evaluateReactive<Node, Token extends object, Value>(
    definition: SelectorDefinition<Node, Value>,
    host: SelectorEvaluationHost<Node, Token>,
    session: SelectorEvaluationSession<Node>,
): SelectorEvaluationProposal<Node, Token, Value> {
    const selector = definition.node
    const previous = host.getSelectorRecord(selector)
    const baseline = host.getComparisonBaseline(selector)
    const dependencies: SelectorDependencySnapshot<Node, Token>[] = []
    const accepted = new Set<Node>()
    const priorNodes = new Set(previous?.dependencies.map(d => d.node))
    const entryVersion = host.getSelectorGraphVersion()
    const entryPublications = session.getSelectorGraphPublicationCount(host)
    let proofVersion = entryVersion
    let proofPublications = entryPublications
    let suppliedReadActive = true

    session.enter(host, selector, dependencies)
    const revalidate = (): void => {
        const version = host.getSelectorGraphVersion()
        const publications = session.getSelectorGraphPublicationCount(host)
        if (version - proofVersion !== publications - proofPublications) {
            for (let i = 0; i < dependencies.length; i++) {
                const path = returnPath(
                    dependencies[i]!.node,
                    selector,
                    host,
                    session,
                )
                if (path === undefined) continue
                for (let j = i; j < dependencies.length; j++)
                    accepted.delete(dependencies[j]!.node)
                dependencies.length = i
                session.latchCycle(
                    host,
                    selector,
                    new SelectorCircularDependencyError(selector, [
                        selector,
                        ...path,
                    ]),
                )
                break
            }
        }
        proofVersion = version
        proofPublications = publications
    }
    session.setPrefixRevalidator(host, selector, revalidate)
    const refresh = (): void => {
        if (
            host.getSelectorGraphVersion() - proofVersion !==
            session.getSelectorGraphPublicationCount(host) - proofPublications
        ) {
            session.revalidateAncestorPrefixes(host, selector)
        }
        revalidate()
    }
    const sticky = (): SelectorOutcome<Value> | undefined => {
        const fault = session.getControlFault()
        if (fault.kind === "fault")
            return { kind: "control-error", error: fault.error }
        const cycle = session.getCycle(host, selector)
        return cycle === undefined ? undefined : { kind: "error", error: cycle }
    }
    const suppliedGet = <DependencyValue>(
        dependency: Node,
    ): DependencyValue => {
        if (!suppliedReadActive) throw new SelectorReadRevokedError()
        const fault = session.getControlFaultForSuppliedRead()
        if (fault.kind === "fault") throw fault.error
        const cycle = session.getCycle(host, selector)
        if (cycle !== undefined) throw cycle
        const active = session.activeCyclePath(host, dependency)
        if (active !== undefined) {
            const error = new SelectorCircularDependencyError(selector, active)
            session.latchCycle(host, selector, error)
            throw error
        }
        const served = host.serve(dependency, session)
        refresh()
        const afterServe = sticky()
        if (afterServe !== undefined && afterServe.kind !== "value")
            throw afterServe.error
        if (!accepted.has(dependency)) {
            // An unchanged committed edge is already a DAG proof. A cold parent
            // cannot be reachable except through its active frame; publications
            // belonging to this session already checked that transient prefix.
            const stableEdge =
                priorNodes.has(dependency) && proofVersion === entryVersion
            const coldParent =
                previous === undefined &&
                proofVersion - entryVersion ===
                    proofPublications - entryPublications
            if (!stableEdge && !coldParent) {
                const path = returnPath(dependency, selector, host, session)
                if (path !== undefined) {
                    const error = new SelectorCircularDependencyError(
                        selector,
                        [selector, ...path],
                    )
                    session.latchCycle(host, selector, error)
                    throw error
                }
            }
            accepted.add(dependency)
            dependencies.push({ node: dependency, token: served.token })
        }
        if (served.outcome.kind === "control-error") {
            session.latchControlFault(served.outcome.error)
            throw served.outcome.error
        }
        if (served.outcome.kind === "error")
            throw new SelectorDependencyError(dependency, served.outcome.error)
        return served.outcome.value as DependencyValue
    }

    const failure = (
        error: unknown,
        phase: "getter" | "comparator",
    ): SelectorOutcome<Value> => {
        try {
            synchronous(error, phase)
        } catch (contained) {
            error = contained
        }
        return {
            kind: "error",
            error:
                error instanceof InvalidSynchronousSelectorResultError
                    ? error
                    : phase === "getter"
                      ? new SelectorGetterError(selector, error)
                      : new SelectorComparatorError(selector, error),
        }
    }
    try {
        let outcome: SelectorOutcome<Value>
        let token: Token | undefined
        try {
            let returned: unknown
            try {
                returned = definition.get(suppliedGet)
            } finally {
                suppliedReadActive = false
            }
            outcome = {
                kind: "value",
                value: synchronous(returned, "getter") as Value,
            }
        } catch (error) {
            outcome = failure(error, "getter")
        }
        refresh()
        outcome = sticky() ?? outcome
        if (outcome.kind === "value" && baseline !== undefined) {
            try {
                const comparison = synchronous(
                    (definition.equal ?? Object.is)(
                        baseline.value as Value,
                        outcome.value,
                    ),
                    "comparator",
                )
                if (comparison !== true && comparison !== false) {
                    outcome = {
                        kind: "error",
                        error: new InvalidSelectorComparatorResultError(),
                    }
                } else if (comparison) {
                    outcome = { kind: "value", value: baseline.value as Value }
                    if (baseline.current) token = baseline.token
                }
            } catch (error) {
                outcome = failure(error, "comparator")
            }
            refresh()
            outcome = sticky() ?? outcome
        }
        return {
            selector,
            token:
                outcome.kind === "value" && token !== undefined
                    ? token
                    : host.createOutcomeToken(),
            outcome,
            dependencies,
            attemptedPrefix:
                outcome.kind === "value" ? [] : dependencies.map(d => d.node),
        }
    } finally {
        suppliedReadActive = false
        session.leave(host, selector)
    }
}
