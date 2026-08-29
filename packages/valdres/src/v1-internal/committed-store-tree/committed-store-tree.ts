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
    readonly ownerToken: object
    activeSession: SelectorEvaluationSession<AnyState> | undefined
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
const RUNTIME_OWNER_KEY = Symbol.for("valdres.runtime-owner/v1")

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

const selectorCapabilityError = (
    operation: "get" | "set" | "createStoreTree",
) =>
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

const runWithDomainGuard = <Result>(
    domain: DomainRecords,
    session: SelectorEvaluationSession<AnyState>,
    operation: () => Result,
): Result => {
    const previousSession = domain.activeSession
    domain.activeSession = session
    try {
        return operation()
    } finally {
        domain.activeSession = previousSession
    }
}

const inspectGuardedSynchronousValue = (
    domain: DomainRecords,
    session: SelectorEvaluationSession<AnyState>,
    value: unknown,
): SynchronousResult => {
    const result = runWithDomainGuard(domain, session, () =>
        inspectSynchronousValue(value),
    )
    const controlFault = session.getControlFault()
    if (controlFault.kind === "fault") throw controlFault.error
    return result
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
    #postSourceApply = false
    #propagationQueue: AnySelector[] | undefined
    #propagationQueued: Set<AnySelector> | undefined
    #propagationControlFault: unknown | undefined
    readonly #domain: DomainRecords

    constructor(domain: DomainRecords) {
        this.#domain = domain
    }

    get<Value>(state: State<Value>): Value {
        const session = new SelectorEvaluationSession<AnyState>()
        const node = state as unknown as AnyState
        const ownerStatus = this.#classifyOwner(node, session)
        if (this.#domain.activeSession !== undefined) {
            throw selectorCapabilityError("get")
        }
        if (ownerStatus === "invalid") {
            throw new TypeError("StoreTree.get requires a valid State")
        }
        const served = this.serve(node, session)
        if (served.outcome.kind !== "value") throw served.outcome.error
        return served.outcome.value as Value
    }

    set<Value>(atom: Atom<Value>, value: Value): void {
        const node = atom as unknown as AnyAtom
        const session = new SelectorEvaluationSession<AnyState>()
        const ownerStatus = this.#classifyOwner(node, session)
        if (this.#domain.activeSession !== undefined) {
            throw selectorCapabilityError("set")
        }
        if (ownerStatus === "invalid") {
            throw new TypeError("StoreTree.set requires a valid Atom")
        }
        if (!this.#domain.atoms.has(node)) {
            throw new TypeError("StoreTree.set requires an Atom")
        }

        const inspected = inspectGuardedSynchronousValue(
            this.#domain,
            session,
            value,
        )
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
        if (this.#classifyOwner(node, session) === "invalid") {
            throw new TypeError("Selector get requires a valid State")
        }
        if (this.#domain.atoms.has(node)) {
            return this.#serveAtom(node as AnyAtom, session)
        }

        const definition = this.#domain.selectors.get(node)
        if (definition === undefined) {
            throw new TypeError("Unknown committed StoreTree state")
        }
        const selector = node as AnySelector
        const current = this.#selectorRecords.get(selector)
        if (current !== undefined && !this.#dirtySelectors.has(selector)) {
            return current.served
        }

        const proposal = runWithDomainGuard(this.#domain, session, () =>
            evaluateSelector(definition, this, session),
        )

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

        const fallback = this.#domain.atoms.get(atom)
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
        return runWithDomainGuard(this.#domain, session, () =>
            runLazyInitializer(initialize),
        )
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
            let cursor = 0
            while (cursor < this.#propagationQueue.length) {
                const selector = this.#propagationQueue[cursor++]!
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

    #classifyOwner(
        state: AnyState,
        session: SelectorEvaluationSession<AnyState>,
    ): "local" | "invalid" {
        if (
            (typeof state === "object" || typeof state === "function") &&
            state !== null &&
            this.#domain.states.has(state)
        ) {
            return "local"
        }
        if (
            (typeof state === "object" || typeof state === "function") &&
            state !== null
        ) {
            const ownerDescriptor = Object.getOwnPropertyDescriptor(
                state,
                RUNTIME_OWNER_KEY,
            )
            if (
                ownerDescriptor !== undefined &&
                "value" in ownerDescriptor &&
                !Object.is(ownerDescriptor.value, this.#domain.ownerToken)
            ) {
                const error = new RuntimeMismatchError()
                const faultSession = this.#domain.activeSession ?? session
                faultSession.latchControlFault(error)
                throw error
            }
        }
        return "invalid"
    }
}

class CommittedStoreTreeFacade implements CommittedStoreTree {
    readonly #host: CommittedStoreTreeHost

    constructor(domain: DomainRecords) {
        this.#host = new CommittedStoreTreeHost(domain)
        Object.freeze(this)
    }

    get<Value>(state: State<Value>): Value {
        return this.#host.get(state)
    }

    set<Value>(atom: Atom<Value>, value: Value): void {
        this.#host.set(atom, value)
    }
}

const EMPTY_DEPENDENCIES = Object.freeze(
    [],
) as readonly SelectorDependencySnapshot<AnyState, OutcomeToken>[]

const makeHandle = <Kind extends "atom" | "selector">(
    kind: Kind,
    ownerToken: object,
): Readonly<{ kind: Kind }> => {
    const handle = { kind }
    Object.defineProperty(handle, RUNTIME_OWNER_KEY, {
        value: ownerToken,
        enumerable: false,
        writable: false,
        configurable: false,
    })
    return Object.freeze(handle)
}

export const createCommittedStoreTreeDomain = (): CommittedStoreTreeDomain => {
    const records: DomainRecords = {
        states: new WeakSet(),
        atoms: new WeakMap(),
        selectors: new WeakMap(),
        ownerToken: Object.freeze({}),
        activeSession: undefined,
    }

    const atom = <Value>(fallback: Value): Atom<Value> => {
        const session =
            records.activeSession ?? new SelectorEvaluationSession<AnyState>()
        const inspected = inspectGuardedSynchronousValue(
            records,
            session,
            fallback,
        )
        if (inspected.kind === "error") throw inspected.error
        const handle = makeHandle(
            "atom",
            records.ownerToken,
        ) as unknown as Atom<Value>
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
        const handle = makeHandle(
            "atom",
            records.ownerToken,
        ) as unknown as Atom<Value>
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
        const handle = makeHandle(
            "selector",
            records.ownerToken,
        ) as unknown as Selector<Value>
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
        createStoreTree: () => {
            if (records.activeSession !== undefined) {
                throw selectorCapabilityError("createStoreTree")
            }
            return new CommittedStoreTreeFacade(records)
        },
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
