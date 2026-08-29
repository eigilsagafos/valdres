import { evaluateSelector } from "../selector-evaluator/evaluate"
import type {
    SelectorComparisonBaseline,
    SelectorDefinition,
    SelectorDependencySnapshot,
    SelectorEvaluationHost,
    SelectorEvaluationProposal,
    SelectorOutcome,
    SelectorRecordView,
    ServedSelectorOutcome,
} from "../selector-evaluator/types"
import { SelectorEvaluationSession } from "../selector-evaluator/types"
import type {
    Atom,
    CommittedStoreTree,
    CommittedStoreTreeDomain,
    Selector,
    SelectorOptions,
    State,
    StateRead,
} from "./types"

type AnyState = State<any>
type AnyAtom = Atom<any>
type AnySelector = Selector<any>

type AtomFallback =
    | Readonly<{ kind: "eager"; value: unknown }>
    | Readonly<{ kind: "lazy"; initialize: () => unknown }>

interface DomainRecords {
    readonly states: WeakSet<object>
    readonly atoms: WeakMap<object, AtomFallback>
    readonly selectors: WeakMap<object, SelectorDefinition<AnyState, any>>
}

type OutcomeToken = Readonly<{ id: number }>

interface SelectorRecord {
    readonly served: ServedSelectorOutcome<OutcomeToken>
    readonly dependencies: readonly SelectorDependencySnapshot<
        AnyState,
        OutcomeToken
    >[]
    readonly lastSuccess:
        | Readonly<{ value: unknown; token: OutcomeToken }>
        | undefined
}

type InspectedThenable =
    | Readonly<{ kind: "not-thenable" }>
    | Readonly<{
          kind: "thenable"
          target: object | ((...args: never[]) => unknown)
          then: (...args: unknown[]) => unknown
      }>
    | Readonly<{ kind: "inspection-error"; error: unknown }>

type SynchronousResult =
    | Readonly<{ kind: "value"; value: unknown }>
    | Readonly<{ kind: "error"; error: unknown }>

const NOT_THENABLE = Object.freeze({ kind: "not-thenable" as const })
const NOOP = (): void => {}
const APPLY = Reflect.apply

/** The stable owner failure that a later public facade will re-export. */
export class RuntimeMismatchError extends Error {
    readonly code = "VALDRES_RUNTIME_MISMATCH"

    constructor() {
        super("Valdres handles belong to a different runtime domain")
        this.name = "RuntimeMismatchError"
        Object.freeze(this)
    }
}

const immutableNamedError = (
    name: string,
    code: string,
    message: string,
): Readonly<Error & { readonly code: string }> => {
    const error = new Error(message) as Error & { code: string }
    error.name = name
    error.code = code
    return Object.freeze(error)
}

const invalidAtomValueError = () =>
    immutableNamedError(
        "InvalidSynchronousAtomValueError",
        "VALDRES_INVALID_SYNCHRONOUS_ATOM_VALUE",
        "Atom values and lazy initializers must be synchronous",
    )

const selectorCapabilityError = (operation: "get" | "set") =>
    immutableNamedError(
        "SelectorCapabilityError",
        "VALDRES_SELECTOR_CAPABILITY_ERROR",
        `A selector callback cannot call StoreTree.${operation} directly`,
    )

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

const inspectSynchronousValue = (value: unknown): SynchronousResult => {
    const inspected = inspectThenable(value)
    if (inspected.kind === "not-thenable") {
        return Object.freeze({ kind: "value" as const, value })
    }
    if (inspected.kind === "inspection-error") {
        return Object.freeze({ kind: "error" as const, error: inspected.error })
    }
    try {
        APPLY(inspected.then, inspected.target, [undefined, NOOP])
    } catch {
        // Containment must not replace the named synchronous-boundary error.
    }
    return Object.freeze({
        kind: "error" as const,
        error: invalidAtomValueError(),
    })
}

const runLazyInitializer = (initialize: () => unknown): SynchronousResult => {
    try {
        return inspectSynchronousValue(initialize())
    } catch (thrown) {
        const inspected = inspectThenable(thrown)
        if (inspected.kind === "not-thenable") {
            return Object.freeze({ kind: "error" as const, error: thrown })
        }
        if (inspected.kind === "inspection-error") {
            return Object.freeze({
                kind: "error" as const,
                error: inspected.error,
            })
        }
        try {
            APPLY(inspected.then, inspected.target, [undefined, NOOP])
        } catch {
            // See inspectSynchronousValue: containment is deliberately inert.
        }
        return Object.freeze({
            kind: "error" as const,
            error: invalidAtomValueError(),
        })
    }
}

const freezeOutcome = <Value>(
    outcome: SelectorOutcome<Value>,
): SelectorOutcome<Value> => Object.freeze(outcome)

class CommittedStoreTreeHost
    implements
        CommittedStoreTree,
        SelectorEvaluationHost<AnyState, OutcomeToken>
{
    readonly #atomRecords = new Map<
        AnyAtom,
        ServedSelectorOutcome<OutcomeToken>
    >()
    readonly #selectorRecords = new Map<AnySelector, SelectorRecord>()
    readonly #reverseEdges = new Map<AnyState, Set<AnySelector>>()
    readonly #dirtySelectors = new Set<AnySelector>()
    #nextToken = 1
    #activeSession: SelectorEvaluationSession<AnyState> | undefined
    #postSourceApply = false
    #propagationQueue: AnySelector[] | undefined
    #propagationQueued: Set<AnySelector> | undefined
    #propagationControlFault: unknown | undefined

    constructor(readonly domain: DomainRecords) {}

    get<Value>(state: State<Value>): Value {
        const session = new SelectorEvaluationSession<AnyState>()
        const node = state as unknown as AnyState
        this.#assertOwner(node, session)
        if (this.#activeSession !== undefined) {
            throw selectorCapabilityError("get")
        }
        const served = this.serve(node, session)
        if (served.outcome.kind !== "value") throw served.outcome.error
        return served.outcome.value as Value
    }

    set<Value>(atom: Atom<Value>, value: Value): void {
        const node = atom as unknown as AnyAtom
        const session = new SelectorEvaluationSession<AnyState>()
        this.#assertOwner(node, session)
        if (this.#activeSession !== undefined) {
            throw selectorCapabilityError("set")
        }
        if (!this.domain.atoms.has(node)) {
            throw new TypeError("StoreTree.set requires an Atom")
        }

        const inspected = inspectSynchronousValue(value)
        if (inspected.kind === "error") throw inspected.error

        const current = this.#serveAtom(node, session)
        if (
            current.outcome.kind === "value" &&
            Object.is(current.outcome.value, inspected.value)
        ) {
            return
        }

        this.#atomRecords.set(
            node,
            Object.freeze({
                token: this.createOutcomeToken(),
                outcome: freezeOutcome({
                    kind: "value",
                    value: inspected.value,
                }),
            }),
        )
        this.#propagateFrom(node)
    }

    serve(
        node: AnyState,
        session: SelectorEvaluationSession<AnyState>,
    ): ServedSelectorOutcome<OutcomeToken> {
        this.#assertOwner(node, session)
        if (this.domain.atoms.has(node)) {
            return this.#serveAtom(node as AnyAtom, session)
        }

        const definition = this.domain.selectors.get(node)
        if (definition === undefined) {
            throw new TypeError("Unknown committed StoreTree state")
        }
        const selector = node as AnySelector
        const current = this.#selectorRecords.get(selector)
        if (current !== undefined && !this.#dirtySelectors.has(selector)) {
            return current.served
        }

        const previousSession = this.#activeSession
        this.#activeSession = session
        let proposal: SelectorEvaluationProposal<AnyState, OutcomeToken>
        try {
            proposal = evaluateSelector(definition, this, session)
        } finally {
            this.#activeSession = previousSession
        }

        if (
            proposal.outcome.kind === "control-error" &&
            !this.#postSourceApply
        ) {
            throw proposal.outcome.error
        }
        return this.#installSelectorProposal(selector, proposal)
    }

    getSelectorRecord(
        node: AnyState,
    ): SelectorRecordView<AnyState, OutcomeToken> | undefined {
        const record = this.#selectorRecords.get(node as AnySelector)
        return record === undefined
            ? undefined
            : Object.freeze({ dependencies: record.dependencies })
    }

    getComparisonBaseline(
        node: AnyState,
    ): SelectorComparisonBaseline<OutcomeToken> | undefined {
        const record = this.#selectorRecords.get(node as AnySelector)
        if (record?.lastSuccess === undefined) return undefined
        return record.served.outcome.kind === "value"
            ? Object.freeze({
                  current: true as const,
                  value: record.lastSuccess.value,
                  token: record.served.token,
              })
            : Object.freeze({
                  current: false as const,
                  value: record.lastSuccess.value,
              })
    }

    createOutcomeToken(): OutcomeToken {
        return Object.freeze({ id: this.#nextToken++ })
    }

    #serveAtom(
        atom: AnyAtom,
        session: SelectorEvaluationSession<AnyState>,
    ): ServedSelectorOutcome<OutcomeToken> {
        const current = this.#atomRecords.get(atom)
        if (current !== undefined) return current

        const fallback = this.domain.atoms.get(atom)
        if (fallback === undefined) {
            throw new TypeError("Unknown committed StoreTree Atom")
        }
        const result =
            fallback.kind === "eager"
                ? Object.freeze({
                      kind: "value" as const,
                      value: fallback.value,
                  })
                : this.#evaluateLazyInitializer(fallback.initialize, session)

        const controlFault = session.getControlFault()
        if (controlFault.kind === "fault") throw controlFault.error

        const served = Object.freeze({
            token: this.createOutcomeToken(),
            outcome: freezeOutcome(
                result.kind === "value"
                    ? { kind: "value", value: result.value }
                    : { kind: "error", error: result.error },
            ),
        })
        this.#atomRecords.set(atom, served)
        return served
    }

    #evaluateLazyInitializer(
        initialize: () => unknown,
        session: SelectorEvaluationSession<AnyState>,
    ): SynchronousResult {
        const previousSession = this.#activeSession
        this.#activeSession = session
        try {
            return runLazyInitializer(initialize)
        } finally {
            this.#activeSession = previousSession
        }
    }

    #installSelectorProposal(
        selector: AnySelector,
        proposal: SelectorEvaluationProposal<AnyState, OutcomeToken>,
    ): ServedSelectorOutcome<OutcomeToken> {
        const previous = this.#selectorRecords.get(selector)
        const served = Object.freeze({
            token: proposal.token,
            outcome: proposal.outcome,
        })
        const record: SelectorRecord = Object.freeze({
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

        this.#replaceReverseEdges(
            selector,
            previous?.dependencies ?? EMPTY_DEPENDENCIES,
            proposal.dependencies,
        )
        this.#selectorRecords.set(selector, record)
        this.#dirtySelectors.delete(selector)

        if (
            previous !== undefined &&
            !Object.is(previous.served.token, proposal.token)
        ) {
            this.#enqueueDependents(selector)
        }
        if (
            proposal.outcome.kind === "control-error" &&
            this.#propagationControlFault === undefined
        ) {
            this.#propagationControlFault = proposal.outcome.error
        }
        return served
    }

    #replaceReverseEdges(
        selector: AnySelector,
        previous: readonly SelectorDependencySnapshot<AnyState, OutcomeToken>[],
        next: readonly SelectorDependencySnapshot<AnyState, OutcomeToken>[],
    ): void {
        for (const dependency of previous) {
            const dependents = this.#reverseEdges.get(dependency.node)
            dependents?.delete(selector)
            if (dependents?.size === 0) {
                this.#reverseEdges.delete(dependency.node)
            }
        }
        for (const dependency of next) {
            let dependents = this.#reverseEdges.get(dependency.node)
            if (dependents === undefined) {
                dependents = new Set()
                this.#reverseEdges.set(dependency.node, dependents)
            }
            dependents.add(selector)
        }
    }

    #propagateFrom(source: AnyState): void {
        this.#propagationQueue = []
        this.#propagationQueued = new Set()
        this.#propagationControlFault = undefined
        this.#postSourceApply = true
        try {
            this.#enqueueDependents(source)
            while (this.#propagationQueue.length > 0) {
                const selector = this.#propagationQueue.shift()!
                if (!this.#dirtySelectors.has(selector)) continue
                this.serve(selector, new SelectorEvaluationSession<AnyState>())
            }
        } finally {
            this.#postSourceApply = false
            this.#propagationQueue = undefined
            this.#propagationQueued = undefined
        }
        if (this.#propagationControlFault !== undefined) {
            throw this.#propagationControlFault
        }
    }

    #enqueueDependents(node: AnyState): void {
        if (
            this.#propagationQueue === undefined ||
            this.#propagationQueued === undefined
        ) {
            return
        }
        for (const selector of this.#reverseEdges.get(node) ?? []) {
            this.#dirtySelectors.add(selector)
            if (this.#propagationQueued.has(selector)) continue
            this.#propagationQueued.add(selector)
            this.#propagationQueue.push(selector)
        }
    }

    #assertOwner(
        state: AnyState,
        session: SelectorEvaluationSession<AnyState>,
    ): void {
        if (
            (typeof state === "object" || typeof state === "function") &&
            state !== null &&
            this.domain.states.has(state)
        ) {
            return
        }
        const error = new RuntimeMismatchError()
        const faultSession = this.#activeSession ?? session
        faultSession.latchControlFault(error)
        throw error
    }
}

const EMPTY_DEPENDENCIES = Object.freeze(
    [],
) as readonly SelectorDependencySnapshot<AnyState, OutcomeToken>[]

const makeHandle = <Kind extends "atom" | "selector">(
    kind: Kind,
): Readonly<{ kind: Kind }> => Object.freeze({ kind })

export const createCommittedStoreTreeDomain = (): CommittedStoreTreeDomain => {
    const records: DomainRecords = {
        states: new WeakSet(),
        atoms: new WeakMap(),
        selectors: new WeakMap(),
    }

    const atom = <Value>(fallback: Value): Atom<Value> => {
        const inspected = inspectSynchronousValue(fallback)
        if (inspected.kind === "error") throw inspected.error
        const handle = makeHandle("atom") as unknown as Atom<Value>
        records.states.add(handle)
        records.atoms.set(
            handle,
            Object.freeze({ kind: "eager", value: inspected.value }),
        )
        return handle
    }

    const atomLazy = <Value>(initialize: () => Value): Atom<Value> => {
        if (typeof initialize !== "function") {
            throw new TypeError("atomLazy requires an initializer function")
        }
        const handle = makeHandle("atom") as unknown as Atom<Value>
        records.states.add(handle)
        records.atoms.set(
            handle,
            Object.freeze({
                kind: "lazy",
                initialize: initialize as () => unknown,
            }),
        )
        return handle
    }

    const selector = <Value>(
        get: (get: StateRead) => Value,
        options: SelectorOptions<Value> = {},
    ): Selector<Value> => {
        if (typeof get !== "function") {
            throw new TypeError("selector requires a getter function")
        }
        if (
            options.equal !== undefined &&
            typeof options.equal !== "function"
        ) {
            throw new TypeError("selector equal must be a function")
        }
        const handle = makeHandle("selector") as unknown as Selector<Value>
        const definition: SelectorDefinition<AnyState, Value> = Object.freeze({
            node: handle as unknown as AnyState,
            get: get as (
                get: <DependencyValue>(node: AnyState) => DependencyValue,
            ) => Value,
            ...(options.equal === undefined ? {} : { equal: options.equal }),
        })
        records.states.add(handle)
        records.selectors.set(handle, definition)
        return handle
    }

    return Object.freeze({
        atom,
        atomLazy,
        selector,
        createStoreTree: () => new CommittedStoreTreeHost(records),
    })
}

export type {
    Atom,
    CommittedStoreTree,
    CommittedStoreTreeDomain,
    Selector,
    SelectorOptions,
    State,
    StateRead,
} from "./types"
