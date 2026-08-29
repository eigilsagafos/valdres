import type { SelectorDefinition } from "../selector-evaluator/types"
import type { Atom, State } from "./types"

export type AnyState = State<any>
export type AnyAtom = Atom<any>

export type AtomFallback =
    | Readonly<{ kind: "eager"; value: unknown }>
    | Readonly<{ kind: "lazy"; initialize: () => unknown }>

export interface AtomDefinition {
    readonly fallback: AtomFallback
    readonly equal?: (previous: unknown, next: unknown) => boolean
}

export interface ControlFaultSession {
    latchControlFault(error: unknown): void
    getControlFault():
        | Readonly<{ kind: "none" }>
        | Readonly<{ kind: "fault"; error: unknown }>
}

export type RuntimeActivity =
    | Readonly<{
          kind: "selector"
          session: ControlFaultSession
      }>
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
      }>

export interface RuntimeDomainRecords {
    readonly states: WeakSet<object>
    readonly atoms: WeakMap<object, AtomDefinition>
    readonly selectors: WeakMap<object, SelectorDefinition<AnyState, any>>
    /** Exact same-domain Store facade recognition; values stay opaque here. */
    readonly stores: WeakMap<object, object>
    /** Exact same-domain Transaction cursor recognition; values stay opaque. */
    readonly transactionCursors: WeakMap<object, object>
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

/** The stable owner failure that a later public facade will re-export. */
export class RuntimeMismatchError extends ImmutableRuntimeError {
    readonly code = "VALDRES_RUNTIME_MISMATCH"

    constructor() {
        super("Valdres handles belong to a different runtime domain")
        this.name = "RuntimeMismatchError"
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
    try {
        const result = runInRuntimeActivity(
            domain,
            Object.freeze({ kind: "guarded-callback", session }),
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
): Result =>
    runInRuntimeActivity(
        domain,
        Object.freeze({ kind: "selector", session }),
        operation,
    )

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

export const makeStateHandle = <Kind extends "atom" | "selector">(
    kind: Kind,
    ownerToken: object,
): Readonly<{ kind: Kind }> =>
    Object.freeze(brandRuntimeHandle({ kind }, ownerToken))
