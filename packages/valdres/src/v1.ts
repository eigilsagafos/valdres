import {
    assertDefinitionFamilyCallAllowed,
    assertDefinitionState,
    markReacquirableDefinitionState,
    runDefinitionCallback,
    type Atom as InternalAtom,
    type AtomUpdater,
    type CommittedStoreTree,
    type RootTransaction,
    type Selector as InternalSelector,
    type State as InternalState,
    type StateRead,
    type TransactionCallback,
} from "./v1-internal/committed-store-tree/committed-store-tree"
import {
    createFamilyAccessor,
    type FamilyKey as InternalFamilyKey,
} from "./v1-internal/family"
import { v1Domain } from "./v1-internal/public-domain"

export type Atom<Value> = InternalAtom<Value>
export type Selector<Value> = InternalSelector<Value>
export type State<Value> = InternalState<Value>
export type Store = CommittedStoreTree
export type Transaction = RootTransaction
export type FamilyKey = InternalFamilyKey

export type { AtomUpdater }
export type EqualFunc<Value> = (previous: Value, next: Value) => boolean
export type GetValue = StateRead
export type SubscribeFn = <Value>(
    state: State<Value>,
    callback: () => void,
) => () => void
export type TransactionFn<Result = unknown> = TransactionCallback<Result>

export interface AtomOptions<Value> {
    readonly name?: string
    readonly equal?: EqualFunc<Value>
}

export interface SelectorOptions<Value> {
    readonly name?: string
    readonly equal?: EqualFunc<Value>
}

type AnyFamilyFactory = (...args: any[]) => State<any>

type PrimitiveFamilyFactory<Factory extends AnyFamilyFactory> =
    Parameters<Factory> extends [FamilyKey, ...FamilyKey[]] ? Factory : never

type NonEmptyFamilyFactory<Factory extends AnyFamilyFactory> =
    Parameters<Factory> extends [unknown, ...unknown[]] ? Factory : never

interface FamilyOptions<Args extends any[]> {
    readonly encodeKey?: (...args: Args) => FamilyKey
}

type EncodedFamilyOptions<Args extends any[]> = FamilyOptions<Args> & {
    readonly encodeKey: (...args: Args) => FamilyKey
}

interface FamilyFactory {
    <Factory extends AnyFamilyFactory>(
        createNode: PrimitiveFamilyFactory<Factory>,
        options?: FamilyOptions<Parameters<Factory>>,
    ): (...args: Parameters<Factory>) => ReturnType<Factory>
    <Factory extends AnyFamilyFactory>(
        createNode: NonEmptyFamilyFactory<Factory>,
        options: EncodedFamilyOptions<Parameters<Factory>>,
    ): (...args: Parameters<Factory>) => ReturnType<Factory>
}

interface AtomFactory {
    <Value>(initial: Value, options?: AtomOptions<Value>): Atom<Value>
    readonly lazy: <Value>(
        initialize: () => Value,
        options?: AtomOptions<Value>,
    ) => Atom<Value>
}

const atomLazy = <Value>(
    initialize: () => Value,
    options: AtomOptions<Value> = {},
): Atom<Value> => v1Domain.atomLazy(initialize, options)

const atomEager = <Value>(
    initial: Value,
    options: AtomOptions<Value> = {},
): Atom<Value> => v1Domain.atom(initial, options)

Object.defineProperty(atomEager, "lazy", {
    configurable: false,
    enumerable: true,
    value: atomLazy,
    writable: false,
})

export const atom = Object.freeze(atomEager) as AtomFactory

export const selector = <Value>(
    read: (get: StateRead) => Value,
    options: SelectorOptions<Value> = {},
): Selector<Value> => v1Domain.selector(read, options)

const defineFamily = (
    ...parameters: unknown[]
): ((...args: any[]) => object) => {
    if (parameters.length === 0 || parameters.length > 2) {
        throw new TypeError("family requires a State factory and options")
    }
    const [createNode, options] = parameters
    if (typeof createNode !== "function") {
        throw new TypeError("family requires a State factory function")
    }
    if (
        options !== undefined &&
        (typeof options !== "object" || options === null)
    ) {
        throw new TypeError("family options must be an object")
    }

    const encodeKey = (options as { readonly encodeKey?: unknown } | undefined)
        ?.encodeKey
    if (encodeKey !== undefined && typeof encodeKey !== "function") {
        throw new TypeError("family encodeKey must be a function")
    }

    return createFamilyAccessor(
        createNode as (...args: any[]) => unknown,
        encodeKey as ((...args: any[]) => unknown) | undefined,
        (phase, callback, args, validate) =>
            runDefinitionCallback(v1Domain, phase, callback, args, validate),
        value => {
            const member = assertDefinitionState(v1Domain, value)
            if (member === undefined) {
                throw new TypeError(
                    "family factories must construct or return a family State",
                )
            }
            return member as object
        },
        member =>
            markReacquirableDefinitionState(
                v1Domain,
                member as InternalState<unknown>,
            ),
        () => assertDefinitionFamilyCallAllowed(v1Domain),
    )
}

export const family = defineFamily as FamilyFactory

export function store(): Store {
    if (arguments.length !== 0) {
        throw new TypeError("store() accepts no arguments")
    }
    return v1Domain.createStoreTree()
}

export {
    CallbackCapabilityError,
    InvalidAtomComparatorResultError,
    InvalidSynchronousAtomValueError,
    InvalidTransactionCallbackResultError,
    InvalidTransactionTargetError,
    RuntimeMismatchError,
    ScopeNotFoundError,
    SelectorCapabilityError,
    StoreDisposedError,
    StoreTreeMismatchError,
    SubscriberNotificationError,
    TransactionClosedError,
    TransactionPhaseError,
} from "./v1-internal/committed-store-tree/committed-store-tree"

export { SelectorCircularDependencyError } from "./v1-internal/selector-evaluator/errors"
