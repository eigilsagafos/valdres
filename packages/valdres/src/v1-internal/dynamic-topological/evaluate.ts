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
    SelectorComparisonBaseline,
    SelectorDefinition,
    SelectorDependencySnapshot,
    SelectorEvaluationHost,
    SelectorEvaluationProposal,
    SelectorEvaluationSession,
    SelectorOutcome,
} from "../selector-evaluator/types"
import { orderFor } from "./order"

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

/** Static candidate selection; host publication owns accept/rollback. */
export const evaluateSelector = <Node, Token extends object, Value>(
    definition: SelectorDefinition<Node, Value>,
    host: SelectorEvaluationHost<Node, Token>,
    session: SelectorEvaluationSession<Node>,
): SelectorEvaluationProposal<Node, Token, Value> => {
    const { node: selector } = definition
    const dependencies: SelectorDependencySnapshot<Node, Token>[] = []
    const dependencyNodes = new Set<Node>()
    const comparisonBaseline = host.getComparisonBaseline(selector) as
        | SelectorComparisonBaseline<Token, Value>
        | undefined
    let suppliedReadActive = true
    const topology = orderFor(host)
    topology.begin(selector as object)
    session.enter(host, selector, dependencies)

    const suppliedGet = <DependencyValue>(
        dependency: Node,
    ): DependencyValue => {
        if (!suppliedReadActive) throw new SelectorReadRevokedError()
        const priorControlFault = session.getControlFaultForSuppliedRead()
        if (priorControlFault.kind === "fault") throw priorControlFault.error
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
        const served = host.serve(dependency, session)
        if (!dependencyNodes.has(dependency)) {
            const path = topology.insert(
                selector as object,
                dependency as object,
            )
            if (path !== undefined) {
                const error = new SelectorCircularDependencyError(
                    selector,
                    path as readonly Node[],
                )
                session.latchCycle(host, selector, error)
                throw error
            }
            dependencyNodes.add(dependency)
            dependencies.push(
                Object.freeze({ node: dependency, token: served.token }),
            )
        }
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
        session.leave(host, selector)
    }
}
