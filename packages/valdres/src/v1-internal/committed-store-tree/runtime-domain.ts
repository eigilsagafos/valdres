import type {
    SelectorDefinition,
    ServedSelectorOutcome,
} from "../selector-evaluator/types"
import type { Atom, Collection, CollectionRow, Selector } from "./types"

/** Definition kinds a family factory may construct or return. */
export type DefinitionState = Atom<any> | Selector<any>
/** Internal dispatch admits every public readonly State kind, while family
 * definition admission deliberately remains Atom-or-Selector. */
export type AnyState =
    | DefinitionState
    | CollectionRow<any, any>
    | Collection<any, any, any, any>
export type AnyAtom = Atom<any>
export const REACQUIRABLE_ATOMS = Symbol()
export const DEFINITION_CALLBACK_FRAME = Symbol()
export const FAMILY_DEFINITIONS = Symbol()
/** Optional, domain-local collection extension. Core owns only this live slot;
 * the tree-shakeable collection module installs the implementation lazily. */
export const COLLECTION_KERNEL = Symbol()

export type AtomFallback =
    | Readonly<{ kind: "eager"; value: unknown }>
    | Readonly<{ kind: "lazy"; initialize: () => unknown }>

export interface AtomDefinition {
    readonly fallback: AtomFallback
    readonly name?: string
    readonly equal?: (previous: unknown, next: unknown) => boolean
}

export interface ControlFaultSession {
    latchControlFault(error: unknown): void
    getControlFault():
        | Readonly<{ kind: "none" }>
        | Readonly<{ kind: "fault"; error: unknown }>
}

export interface DefinitionCallbackFrame {
    readonly session: ControlFaultSession
    /** Allocated only when allowDefinitions is true (phase === "factory").
     * Every other phase (encoder, family-encoder, collection-encoder) can
     * never construct a State: registerRuntimeStateHandle, the one call site
     * that adds to this set, always runs
     * assertRuntimeDefinitionConstructionAllowed first, which throws for a
     * non-factory frame before that call is reached. Leaving this undefined
     * for those phases keeps a per-call encoder invocation (e.g. family's
     * encodeKey, run on every access, not just on a cache miss) free of a
     * WeakSet it can structurally never populate. A phase added later must
     * preserve this invariant — allowDefinitions must stay the single
     * source of truth for "does this frame own a definitions set" — rather
     * than introduce a case that is sometimes allowed to construct under a
     * non-factory phase. */
    readonly definitions: WeakSet<object> | undefined
    readonly allowDefinitions: boolean
    /** Optional accessor-only policy. Collection owns its TypeError text and
     * injects the factory only for a collection encoder frame. */
    readonly createAccessorFault?: () => TypeError
    accessorFault?: TypeError
}

export interface SelectorRuntimeActivity {
    readonly kind: "selector"
    readonly session: ControlFaultSession
    readonly parentSelectorActivity?: SelectorRuntimeActivity
}

export type RuntimeActivity =
    | Readonly<SelectorRuntimeActivity>
    | Readonly<{
          kind: "transaction"
          transaction: object
      }>
    | Readonly<{
          kind: "transaction-result"
          session: ControlFaultSession
      }>
    | Readonly<{
          kind: "guarded-callback"
          session: ControlFaultSession
          selectorActivity?: SelectorRuntimeActivity
      }>
    | Readonly<{
          kind: "subscriber"
          session: ControlFaultSession
      }>

export interface RuntimeDomainRecords {
    readonly states: WeakSet<object>
    /** Successfully published family members, weakly recognized for aliases. */
    [FAMILY_DEFINITIONS]?: WeakSet<object>
    /** Synchronous construction frame; restored before public work resumes. */
    [DEFINITION_CALLBACK_FRAME]?: DefinitionCallbackFrame
    /** Keyed definition helpers may opt exact Atoms into override retention. */
    [REACQUIRABLE_ATOMS]?: WeakSet<object>
    readonly atoms: WeakMap<object, AtomDefinition>
    readonly selectors: WeakMap<object, SelectorDefinition<AnyState, any>>
    /** Exact same-domain Store facade recognition; values stay opaque here. */
    readonly stores: WeakMap<object, object>
    /** Exact same-domain Transaction cursor recognition; values stay opaque. */
    readonly transactionCursors: WeakMap<object, object>
    /** Absent until the first successfully recorded collection definition. */
    [COLLECTION_KERNEL]?: OptionalCollectionVTable
    readonly ownerToken: object
    activity: RuntimeActivity | undefined
}

type InspectedThenable =
    | Readonly<{ kind: "not-thenable" }>
    | Readonly<{
          kind: "thenable"
          target: object | ((...args: never[]) => unknown)
          then: (...args: unknown[]) => unknown
      }>
    | Readonly<{ kind: "inspection-error"; error: unknown }>

export type SynchronousResult =
    | Readonly<{ kind: "value"; value: unknown }>
    | Readonly<{ kind: "error"; error: unknown }>

/** Opaque commit plan produced by the optional collection extension. */
export interface CollectionCommitPlan {
    commit(phase: 0): boolean
    commit(phase: 1): void
    commit(phase: 2): readonly CollectionCommitSource[] | undefined
}

/** Opaque-to-core source coordinate returned after collection settlement. */
export interface CollectionCommitSource {
    readonly scope: object
    readonly atom: AnyState
}

export type CollectionMutationKind = "set" | "update" | "reset" | "delete"

/** One-way optional extension seam. The eager runtime never imports the
 * collection implementation and always reads this slot live, so a collection
 * defined after Store construction is visible to every same-domain Store. */
export interface OptionalCollectionVTable {
    has(node: AnyState): boolean
    read(draft: object, scope: object, node: AnyState): SynchronousResult
    stage(
        draft: object,
        scope: object,
        operation: CollectionMutationKind,
        row: AnyState,
        input: unknown,
        session: ControlFaultSession,
    ): void
    scope(
        scope: object,
        node?: AnyState,
    ): ServedSelectorOutcome<object> | undefined
    plan(draft: object): CollectionCommitPlan | undefined
}

const NOT_THENABLE = Object.freeze({ kind: "not-thenable" as const })
const NOOP = (): void => {}
const APPLY = Reflect.apply
const RUNTIME_OWNER_KEY = Symbol.for("valdres.runtime-owner/v1")

abstract class ImmutableRuntimeError extends Error {
    abstract readonly code: string

    protected seal(): void {
        Object.freeze(this)
    }
}

/** The stable owner failure re-exported by the public runtime facade. */
export class RuntimeMismatchError extends ImmutableRuntimeError {
    readonly code = "VALDRES_RUNTIME_MISMATCH"

    constructor() {
        super("Valdres handles belong to a different runtime domain")
        this.name = "RuntimeMismatchError"
        this.seal()
    }
}

export class SubscriberNotificationError extends ImmutableRuntimeError {
    readonly code = "VALDRES_SUBSCRIBER_NOTIFICATION"
    readonly cause: unknown
    readonly causes: readonly unknown[]
    readonly committed = true
    readonly phase = "notifying"
    readonly source = "owned-mutation"

    constructor(causes: readonly unknown[]) {
        super("One or more Store subscribers threw during notification")
        this.name = "SubscriberNotificationError"
        this.causes = Object.freeze([...causes])
        this.cause = this.causes[0]
        this.seal()
    }
}

export class CallbackCapabilityError extends ImmutableRuntimeError {
    readonly code = "VALDRES_CALLBACK_CAPABILITY"

    constructor() {
        super("This callback cannot use captured Valdres runtime capabilities")
        this.name = "CallbackCapabilityError"
        this.seal()
    }
}

export class SelectorCapabilityError extends ImmutableRuntimeError {
    readonly code = "VALDRES_SELECTOR_CAPABILITY_ERROR"

    constructor(operation: string) {
        super(`A selector callback cannot call ${operation} directly`)
        this.name = "SelectorCapabilityError"
        this.seal()
    }
}

export class TransactionPhaseError extends ImmutableRuntimeError {
    readonly code = "VALDRES_TRANSACTION_PHASE"

    constructor() {
        super("Captured StoreTree work is forbidden during a transaction")
        this.name = "TransactionPhaseError"
        this.seal()
    }
}

export class TransactionClosedError extends ImmutableRuntimeError {
    readonly code = "VALDRES_TRANSACTION_CLOSED"

    constructor() {
        super("The Transaction cursor is no longer active")
        this.name = "TransactionClosedError"
        this.seal()
    }
}

export class InvalidTransactionCallbackResultError extends ImmutableRuntimeError {
    readonly code = "VALDRES_INVALID_TRANSACTION_CALLBACK_RESULT"

    constructor() {
        super("Transaction callbacks must return synchronously")
        this.name = "InvalidTransactionCallbackResultError"
        this.seal()
    }
}

export class InvalidSynchronousAtomValueError extends ImmutableRuntimeError {
    readonly code = "VALDRES_INVALID_SYNCHRONOUS_ATOM_VALUE"

    constructor() {
        super("Atom values and lazy initializers must be synchronous")
        this.name = "InvalidSynchronousAtomValueError"
        this.seal()
    }
}

export class InvalidAtomComparatorResultError extends ImmutableRuntimeError {
    readonly code = "VALDRES_INVALID_ATOM_COMPARATOR_RESULT"

    constructor() {
        super(
            "Atom comparators must return exactly true or false synchronously",
        )
        this.name = "InvalidAtomComparatorResultError"
        this.seal()
    }
}

export class StoreDisposedError extends ImmutableRuntimeError {
    readonly code = "VALDRES_STORE_DISPOSED"

    constructor() {
        super("This Store has been disposed")
        this.name = "StoreDisposedError"
        this.seal()
    }
}

export class ScopeNotFoundError extends ImmutableRuntimeError {
    readonly code = "VALDRES_SCOPE_NOT_FOUND"

    constructor() {
        super("The named child Store does not exist")
        this.name = "ScopeNotFoundError"
        this.seal()
    }
}

export class StoreTreeMismatchError extends ImmutableRuntimeError {
    readonly code = "VALDRES_STORE_TREE_MISMATCH"

    constructor() {
        super("The Store belongs to a different StoreTree")
        this.name = "StoreTreeMismatchError"
        this.seal()
    }
}

export class InvalidTransactionTargetError extends ImmutableRuntimeError {
    readonly code = "VALDRES_INVALID_TRANSACTION_TARGET"

    constructor() {
        super("Transaction.scope requires a Store or named child")
        this.name = "InvalidTransactionTargetError"
        this.seal()
    }
}

export const inspectThenable = (value: unknown): InspectedThenable => {
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

export const containThenable = (
    inspected: Extract<InspectedThenable, { kind: "thenable" }>,
): void => {
    try {
        APPLY(inspected.then, inspected.target, [undefined, NOOP])
    } catch {
        // Containment must never replace the synchronous-boundary failure.
    }
}

export const inspectSynchronousAtomValue = (
    value: unknown,
): SynchronousResult => {
    const inspected = inspectThenable(value)
    if (inspected.kind === "not-thenable") {
        return Object.freeze({ kind: "value" as const, value })
    }
    if (inspected.kind === "inspection-error") {
        return Object.freeze({ kind: "error" as const, error: inspected.error })
    }
    containThenable(inspected)
    return Object.freeze({
        kind: "error" as const,
        error: new InvalidSynchronousAtomValueError(),
    })
}

export const runLazyInitializer = (
    initialize: () => unknown,
): SynchronousResult => {
    try {
        return inspectSynchronousAtomValue(initialize())
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
        containThenable(inspected)
        return Object.freeze({
            kind: "error" as const,
            error: new InvalidSynchronousAtomValueError(),
        })
    }
}

export const runInRuntimeActivity = <Result>(
    domain: RuntimeDomainRecords,
    activity: RuntimeActivity,
    operation: () => Result,
): Result => {
    const previous = domain.activity
    domain.activity = activity
    try {
        return operation()
    } finally {
        domain.activity = previous
    }
}

export const runGuardedCallback = <Result>(
    domain: RuntimeDomainRecords,
    session: ControlFaultSession,
    operation: () => Result,
): Result => {
    const previous = domain.activity
    const selectorActivity =
        previous?.kind === "selector"
            ? previous
            : previous?.kind === "guarded-callback"
              ? previous.selectorActivity
              : undefined
    const activity: RuntimeActivity =
        selectorActivity === undefined
            ? Object.freeze({ kind: "guarded-callback", session })
            : Object.freeze({
                  kind: "guarded-callback",
                  session,
                  selectorActivity,
              })
    try {
        const result = runInRuntimeActivity(domain, activity, operation)
        const controlFault = session.getControlFault()
        if (controlFault.kind === "fault") throw controlFault.error
        return result
    } catch (error) {
        const controlFault = session.getControlFault()
        if (controlFault.kind === "fault") throw controlFault.error
        throw error
    }
}

export const runSubscriberActivity = <Result>(
    domain: RuntimeDomainRecords,
    session: ControlFaultSession,
    operation: () => Result,
): Result => {
    try {
        const result = runInRuntimeActivity(
            domain,
            Object.freeze({ kind: "subscriber", session }),
            operation,
        )
        const controlFault = session.getControlFault()
        if (controlFault.kind === "fault") throw controlFault.error
        return result
    } catch (error) {
        const controlFault = session.getControlFault()
        if (controlFault.kind === "fault") throw controlFault.error
        throw error
    }
}

export const runSelectorActivity = <Result>(
    domain: RuntimeDomainRecords,
    session: ControlFaultSession,
    operation: () => Result,
): Result => {
    const previous = domain.activity
    const currentSelectorActivity =
        previous?.kind === "selector"
            ? previous
            : previous?.kind === "guarded-callback"
              ? previous.selectorActivity
              : undefined
    // Recursive selectors ordinarily share one session. Skip that duplicate
    // link while retaining any distinct administrative session underneath it.
    const parentSelectorActivity = Object.is(
        currentSelectorActivity?.session,
        session,
    )
        ? currentSelectorActivity?.parentSelectorActivity
        : currentSelectorActivity
    const activity: SelectorRuntimeActivity =
        parentSelectorActivity === undefined
            ? Object.freeze({ kind: "selector", session })
            : Object.freeze({
                  kind: "selector",
                  session,
                  parentSelectorActivity,
              })
    return runInRuntimeActivity(domain, activity, operation)
}

export const runTransactionActivity = <Result>(
    domain: RuntimeDomainRecords,
    transaction: object,
    operation: () => Result,
): Result =>
    runInRuntimeActivity(
        domain,
        Object.freeze({ kind: "transaction", transaction }),
        operation,
    )

export const runTransactionResultActivity = <Result>(
    domain: RuntimeDomainRecords,
    session: ControlFaultSession,
    operation: () => Result,
): Result => {
    try {
        const result = runInRuntimeActivity(
            domain,
            Object.freeze({ kind: "transaction-result", session }),
            operation,
        )
        const controlFault = session.getControlFault()
        if (controlFault.kind === "fault") throw controlFault.error
        return result
    } catch (error) {
        const controlFault = session.getControlFault()
        if (controlFault.kind === "fault") throw controlFault.error
        throw error
    }
}

export const assertStoreOperationAllowed = (
    domain: RuntimeDomainRecords,
    operation: string,
): void => {
    const activity = domain.activity
    if (activity === undefined) return
    if (activity.kind === "selector") {
        throw new SelectorCapabilityError(operation)
    }
    if (
        activity.kind === "transaction" ||
        activity.kind === "transaction-result"
    ) {
        throw new TransactionPhaseError()
    }
    throw new CallbackCapabilityError()
}

export const assertStoreReadAllowed = (
    domain: RuntimeDomainRecords,
    operation: string,
): ControlFaultSession | undefined => {
    const activity = domain.activity
    if (activity === undefined) return undefined
    if (activity.kind === "subscriber") return activity.session
    if (activity.kind === "selector") {
        throw new SelectorCapabilityError(operation)
    }
    if (
        activity.kind === "transaction" ||
        activity.kind === "transaction-result"
    ) {
        throw new TransactionPhaseError()
    }
    throw new CallbackCapabilityError()
}

/** Reject a selector-supplied read borrowed by a nested guarded callback. */
export const rejectGuardedSelectorRead = (
    callbackSession: ControlFaultSession,
    selectorSession: ControlFaultSession,
): never => {
    const selectorFault = selectorSession.getControlFault()
    const callbackFault = callbackSession.getControlFault()
    const error =
        selectorFault.kind === "fault"
            ? selectorFault.error
            : callbackFault.kind === "fault"
              ? callbackFault.error
              : new CallbackCapabilityError()
    callbackSession.latchControlFault(error)
    selectorSession.latchControlFault(error)
    throw error
}

export const assertUnsubscribeAllowed = (
    domain: RuntimeDomainRecords,
): void => {
    const activity = domain.activity
    if (activity === undefined || activity.kind === "subscriber") return
    if (activity.kind === "selector") {
        throw new SelectorCapabilityError("Store unsubscribe")
    }
    if (
        activity.kind === "transaction" ||
        activity.kind === "transaction-result"
    ) {
        throw new TransactionPhaseError()
    }
    throw new CallbackCapabilityError()
}

export const assertCursorOperationAllowed = (
    domain: RuntimeDomainRecords,
    transaction: object,
    active: boolean,
): void => {
    if (!active) throw new TransactionClosedError()
    const activity = domain.activity
    if (
        activity?.kind === "transaction" &&
        Object.is(activity.transaction, transaction)
    ) {
        return
    }
    if (activity?.kind === "selector") {
        throw new SelectorCapabilityError("Transaction cursor operation")
    }
    if (activity?.kind === "guarded-callback") {
        throw new CallbackCapabilityError()
    }
    throw new TransactionPhaseError()
}

const currentFaultSession = (
    domain: RuntimeDomainRecords,
    fallback: ControlFaultSession,
): ControlFaultSession => {
    const activity = domain.activity
    return activity !== undefined && "session" in activity
        ? activity.session
        : fallback
}

export const classifyOwner = (
    domain: RuntimeDomainRecords,
    value: unknown,
    session: ControlFaultSession,
): "local" | "invalid" => {
    if (
        (typeof value === "object" || typeof value === "function") &&
        value !== null &&
        (domain.states.has(value) ||
            domain.stores.has(value) ||
            domain.transactionCursors.has(value))
    ) {
        return "local"
    }
    if (
        (typeof value === "object" || typeof value === "function") &&
        value !== null
    ) {
        const ownerDescriptor = Object.getOwnPropertyDescriptor(
            value,
            RUNTIME_OWNER_KEY,
        )
        if (
            ownerDescriptor !== undefined &&
            "value" in ownerDescriptor &&
            !Object.is(ownerDescriptor.value, domain.ownerToken)
        ) {
            const error = new RuntimeMismatchError()
            currentFaultSession(domain, session).latchControlFault(error)
            throw error
        }
    }
    return "invalid"
}

export const classifyEntryOwner = (
    domain: RuntimeDomainRecords,
    value: unknown,
    session: ControlFaultSession,
): "local" | "invalid" => {
    if (
        (typeof value === "object" || typeof value === "function") &&
        value !== null &&
        (domain.states.has(value) ||
            domain.stores.has(value) ||
            domain.transactionCursors.has(value))
    ) {
        return "local"
    }

    const activity = domain.activity
    const faultSession = currentFaultSession(domain, session)
    if (activity !== undefined && "session" in activity) {
        try {
            const owner = classifyOwner(domain, value, faultSession)
            const fault = faultSession.getControlFault()
            if (fault.kind === "fault") throw fault.error
            return owner
        } catch (error) {
            const fault = faultSession.getControlFault()
            if (fault.kind === "fault") throw fault.error
            throw error
        }
    }
    return runGuardedCallback(domain, faultSession, () =>
        classifyOwner(domain, value, faultSession),
    )
}

export const brandRuntimeHandle = <Value extends object>(
    value: Value,
    ownerToken: object,
): Value => {
    Object.defineProperty(value, RUNTIME_OWNER_KEY, {
        value: ownerToken,
        enumerable: false,
        writable: false,
        configurable: false,
    })
    return value
}

/** Rejects State construction before validation or other observable work in a
 * definition callback that has no construction capability. An already-latched
 * control fault always wins so a caught later construction attempt cannot
 * replace the authoritative callback failure. */
export const assertRuntimeDefinitionConstructionAllowed = (
    domain: RuntimeDomainRecords,
): void => {
    const frame = domain[DEFINITION_CALLBACK_FRAME]
    if (frame === undefined || frame.allowDefinitions) return
    const controlFault = frame.session.getControlFault()
    if (controlFault.kind === "fault") throw controlFault.error
    const error = new CallbackCapabilityError()
    frame.session.latchControlFault(error)
    throw error
}

/** Create the mutable ordinary-object shape used by built-in State handles.
 * Arbitrary callable readonly definitions use registerRuntimeStateHandle
 * directly instead. */
export const makeStateHandle = <Kind extends AnyState["kind"]>(
    kind: Kind,
): { kind: Kind } => ({ kind })

/** Capability-check, same-domain brand, register, and freeze one definition
 * handle. Kept neutral so optional definition modules remain tree-shakeable. */
export const registerRuntimeStateHandle = <Handle extends object>(
    domain: RuntimeDomainRecords,
    mutableHandle: Handle,
): Readonly<Handle> => {
    assertRuntimeDefinitionConstructionAllowed(domain)
    const frame = domain[DEFINITION_CALLBACK_FRAME]

    const handle = Object.freeze(
        brandRuntimeHandle(mutableHandle, domain.ownerToken),
    )
    domain.states.add(handle)
    // assertRuntimeDefinitionConstructionAllowed above already rejected this
    // call unless frame is undefined or frame.allowDefinitions is true, and
    // only a factory-phase frame (allowDefinitions: true) ever allocates
    // definitions — see runDefinitionCallback. The `?.` is for frame itself,
    // not for this structurally-guaranteed set.
    frame?.definitions?.add(handle)
    return handle
}
