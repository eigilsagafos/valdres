import {
    type Atom as InternalAtom,
    type AtomUpdater,
    type CommittedStoreTree,
    type RootTransaction,
    type Selector as InternalSelector,
    type State as InternalState,
    type StateRead,
    type TransactionCallback,
} from "./v1-internal/committed-store-tree/committed-store-tree"
import { v1Domain } from "./v1-internal/public-domain"

export type Atom<Value> = InternalAtom<Value>
export type Selector<Value> = InternalSelector<Value>
export type State<Value> = InternalState<Value>
export type Store = CommittedStoreTree
export type Transaction = RootTransaction

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
