import type { CollectionIndexSchema } from "./v1-internal/committed-store-tree/types"
import * as v1 from "./v1"

interface CollectionFactory {
    <Key extends CollectionKey, Value extends CollectionValue>(
        options?: CollectionOptions<Key, Value, Key>,
    ): Collection<Key, Value, Key>
    <
        Key extends CollectionKey,
        Value extends CollectionValue,
        Input,
        Indexes extends CollectionIndexSchema<Indexes> = never,
    >(
        options: CollectionOptions<Key, Value, Input, Indexes>,
    ): Collection<Key, Value, Input, Indexes>
}

interface PresenceFactory {
    <Key extends CollectionKey, Value extends CollectionValue>(
        row: CollectionRow<Key, Value>,
    ): Selector<boolean>
}

interface ExternalAtomFactory {
    <Value>(
        source: ExternalSource<Value>,
        options?: ExternalAtomOptions,
    ): ExternalAtom<Value>
}

// Concrete entry-owned bindings avoid a Bun split-entry re-export bug while
// preserving the exact constructor/function identities from src/v1.ts.
export const atom: typeof v1.atom = v1.atom
export const collection: CollectionFactory = v1.collection
export const externalAtom: ExternalAtomFactory = v1.externalAtom
export const family: typeof v1.family = v1.family
export const presence: PresenceFactory = v1.presence
export const selector: typeof v1.selector = v1.selector
export const store: typeof v1.store = v1.store

export const CallbackCapabilityError: typeof v1.CallbackCapabilityError =
    v1.CallbackCapabilityError
export const InvalidAtomComparatorResultError: typeof v1.InvalidAtomComparatorResultError =
    v1.InvalidAtomComparatorResultError
export const InvalidCollectionKeyError: typeof v1.InvalidCollectionKeyError =
    v1.InvalidCollectionKeyError
export const InvalidSynchronousCollectionValueError: typeof v1.InvalidSynchronousCollectionValueError =
    v1.InvalidSynchronousCollectionValueError
export const InvalidSynchronousAtomValueError: typeof v1.InvalidSynchronousAtomValueError =
    v1.InvalidSynchronousAtomValueError
export const InvalidTransactionCallbackResultError: typeof v1.InvalidTransactionCallbackResultError =
    v1.InvalidTransactionCallbackResultError
export const InvalidTransactionTargetError: typeof v1.InvalidTransactionTargetError =
    v1.InvalidTransactionTargetError
export const MissingCollectionRowError: typeof v1.MissingCollectionRowError =
    v1.MissingCollectionRowError
export const RuntimeMismatchError: typeof v1.RuntimeMismatchError =
    v1.RuntimeMismatchError
export const ScopeNotFoundError: typeof v1.ScopeNotFoundError =
    v1.ScopeNotFoundError
export const SelectorCapabilityError: typeof v1.SelectorCapabilityError =
    v1.SelectorCapabilityError
export const SelectorCircularDependencyError: typeof v1.SelectorCircularDependencyError =
    v1.SelectorCircularDependencyError
export const SettleLimitError: typeof v1.SettleLimitError = v1.SettleLimitError
export const StoreDisposedError: typeof v1.StoreDisposedError =
    v1.StoreDisposedError
export const StoreTreeMismatchError: typeof v1.StoreTreeMismatchError =
    v1.StoreTreeMismatchError
export const SubscriberNotificationError: typeof v1.SubscriberNotificationError =
    v1.SubscriberNotificationError
export const TransactionClosedError: typeof v1.TransactionClosedError =
    v1.TransactionClosedError
export const TransactionPhaseError: typeof v1.TransactionPhaseError =
    v1.TransactionPhaseError
export const UndefinedCollectionValueError: typeof v1.UndefinedCollectionValueError =
    v1.UndefinedCollectionValueError

export type Atom<Value> = v1.Atom<Value>
export type AtomOptions<Value> = v1.AtomOptions<Value>
export type AtomUpdater<Value> = v1.AtomUpdater<Value>
export type Collection<
    Key extends v1.CollectionKey,
    Value extends v1.CollectionValue,
    Input = Key,
    Indexes = never,
> = v1.Collection<Key, Value, Input, Indexes>
export type CollectionKey = v1.CollectionKey
export type CollectionOptions<
    Key extends CollectionKey,
    Value extends CollectionValue,
    Input = Key,
    Indexes extends CollectionIndexSchema<Indexes> = never,
> = v1.CollectionOptions<Key, Value, Input, Indexes>
export type CollectionRow<
    Key extends CollectionKey,
    Value extends CollectionValue,
> = v1.CollectionRow<Key, Value>
export type CollectionValue = v1.CollectionValue
export type EqualFunc<Value> = v1.EqualFunc<Value>
export type ExternalSource<Value> = v1.ExternalSource<Value>
export type ExternalAtom<Value> = v1.ExternalAtom<Value>
export type ExternalAtomOptions = v1.ExternalAtomOptions
export type FamilyKey = v1.FamilyKey
export type GetValue = v1.GetValue
export type Selector<Value> = v1.Selector<Value>
export type SelectorOptions<Value> = v1.SelectorOptions<Value>
export type State<Value> = v1.State<Value>
export type Store = v1.Store
export type SubscribeFn = v1.SubscribeFn
export type Transaction = v1.Transaction
export type TransactionFn<Result = unknown> = v1.TransactionFn<Result>

export type CallbackCapabilityError = InstanceType<
    typeof v1.CallbackCapabilityError
>
export type InvalidAtomComparatorResultError = InstanceType<
    typeof v1.InvalidAtomComparatorResultError
>
export type InvalidCollectionKeyError = InstanceType<
    typeof v1.InvalidCollectionKeyError
>
export type InvalidSynchronousCollectionValueError = InstanceType<
    typeof v1.InvalidSynchronousCollectionValueError
>
export type InvalidSynchronousAtomValueError = InstanceType<
    typeof v1.InvalidSynchronousAtomValueError
>
export type InvalidTransactionCallbackResultError = InstanceType<
    typeof v1.InvalidTransactionCallbackResultError
>
export type InvalidTransactionTargetError = InstanceType<
    typeof v1.InvalidTransactionTargetError
>
export type MissingCollectionRowError = InstanceType<
    typeof v1.MissingCollectionRowError
>
export type RuntimeMismatchError = InstanceType<typeof v1.RuntimeMismatchError>
export type ScopeNotFoundError = InstanceType<typeof v1.ScopeNotFoundError>
export type SelectorCapabilityError = InstanceType<
    typeof v1.SelectorCapabilityError
>
export type SelectorCircularDependencyError = InstanceType<
    typeof v1.SelectorCircularDependencyError
>
export type SettleLimitError = InstanceType<typeof v1.SettleLimitError>
export type StoreDisposedError = InstanceType<typeof v1.StoreDisposedError>
export type StoreTreeMismatchError = InstanceType<
    typeof v1.StoreTreeMismatchError
>
export type SubscriberNotificationError = InstanceType<
    typeof v1.SubscriberNotificationError
>
export type TransactionClosedError = InstanceType<
    typeof v1.TransactionClosedError
>
export type TransactionPhaseError = InstanceType<
    typeof v1.TransactionPhaseError
>
export type UndefinedCollectionValueError = InstanceType<
    typeof v1.UndefinedCollectionValueError
>

export const DormantExternalReadError: typeof v1.DormantExternalReadError =
    v1.DormantExternalReadError
export type DormantExternalReadError = InstanceType<
    typeof v1.DormantExternalReadError
>

export const ExternalSourceDeliveryLimitError: typeof v1.ExternalSourceDeliveryLimitError =
    v1.ExternalSourceDeliveryLimitError
export type ExternalSourceDeliveryLimitError = InstanceType<
    typeof v1.ExternalSourceDeliveryLimitError
>

export const ExternalSourceNonConvergenceError: typeof v1.ExternalSourceNonConvergenceError =
    v1.ExternalSourceNonConvergenceError
export type ExternalSourceNonConvergenceError = InstanceType<
    typeof v1.ExternalSourceNonConvergenceError
>

export const ExternalSourceOperationError: typeof v1.ExternalSourceOperationError =
    v1.ExternalSourceOperationError
export type ExternalSourceOperationError = InstanceType<
    typeof v1.ExternalSourceOperationError
>

export const InvalidExternalCleanupError: typeof v1.InvalidExternalCleanupError =
    v1.InvalidExternalCleanupError
export type InvalidExternalCleanupError = InstanceType<
    typeof v1.InvalidExternalCleanupError
>

export const InvalidSynchronousExternalSnapshotError: typeof v1.InvalidSynchronousExternalSnapshotError =
    v1.InvalidSynchronousExternalSnapshotError
export type InvalidSynchronousExternalSnapshotError = InstanceType<
    typeof v1.InvalidSynchronousExternalSnapshotError
>

export const ServerSnapshotUnavailableError: typeof v1.ServerSnapshotUnavailableError =
    v1.ServerSnapshotUnavailableError
export type ServerSnapshotUnavailableError = InstanceType<
    typeof v1.ServerSnapshotUnavailableError
>
