declare const privateStateValue: unique symbol
declare const privateCollectionTypes: unique symbol
declare const privateCollectionOptionTypes: unique symbol

/** @internal Shared invariant marker for every State definition arm. */
interface StateBase<Value> {
    /** @internal Invariant type marker; no runtime property is installed. */
    readonly [privateStateValue]: (value: Value) => Value
}

/** @internal Readonly State arms implemented by the optional collection runtime. */
interface ReadonlyState<Value, Kind extends "collection-row" | "collection">
    extends StateBase<Value> {
    readonly kind: Kind
}

/** A StoreTree-local writable cell definition. The handle itself owns no value. */
export interface Atom<Value> extends StateBase<Value> {
    readonly kind: "atom"
}

/** A pure synchronous derived-state definition. */
export interface Selector<Value> extends StateBase<Value> {
    readonly kind: "selector"
}

/** Any definition that can be read and subscribed through a Store. */
export type State<Value> =
    | Atom<Value>
    | Selector<Value>
    | ReadonlyState<Value, "collection-row">
    | ReadonlyState<Value, "collection">

export type CollectionKey = string | number | bigint | boolean | null

/** `undefined` is reserved for an absent collection row. */
export type CollectionValue =
    | null
    | boolean
    | number
    | bigint
    | string
    | symbol
    | object

/** One readonly, scope-local row in a Collection. */
export interface CollectionRow<
    Key extends CollectionKey,
    Value extends CollectionValue,
> extends ReadonlyState<Value | undefined, "collection-row"> {
    readonly kind: "collection-row"
    readonly key: Key
}

/** A callable readonly State containing its currently present rows. */
export interface Collection<
    Key extends CollectionKey,
    Value extends CollectionValue,
    Input = Key,
    Indexes = never,
> extends ReadonlyState<readonly CollectionRow<Key, Value>[], "collection"> {
    readonly kind: "collection"
    readonly [privateCollectionTypes]: {
        readonly key: Key
        readonly value: Value
        readonly indexes: Indexes
        readonly input: Input
    }
    (input: Input): CollectionRow<Key, Value>
}

interface CollectionOptionCarrier<
    Key extends CollectionKey,
    Value extends CollectionValue,
    Input,
> {
    /** Index definitions remain closed until their public contract is frozen. */
    readonly indexes?: never
    readonly [privateCollectionOptionTypes]?: {
        readonly key: (key: Key) => Key
        readonly value: (value: Value) => Value
        readonly input: (input: Input) => Input
    }
}

/** Definition-time options for canonical or rich-input Collection keys. */
export type CollectionOptions<
    Key extends CollectionKey,
    Value extends CollectionValue,
    Input = Key,
> = CollectionOptionCarrier<Key, Value, Input> &
    (
        | { readonly encodeKey: (input: Input) => Key }
        | ([Input] extends [Key] ? { readonly encodeKey?: never } : never)
    )

export type StateRead = <Value>(state: State<Value>) => Value

export interface AtomOptions<Value> {
    readonly name?: string
    readonly equal?: (previous: Value, next: Value) => boolean
}

export interface SelectorOptions<Value> {
    readonly name?: string
    readonly equal?: (previous: Value, next: Value) => boolean
}

export type AtomUpdater<Value> = (current: Value) => Value

/** A scope-bound revocable view over one internal StoreTree draft. */
export interface RootTransaction {
    get<Value>(state: State<Value>): Value
    set<Key extends CollectionKey, Value extends CollectionValue>(
        row: CollectionRow<Key, Value>,
        value: Value,
    ): void
    set<Value>(atom: Atom<Value>, value: Value): void
    update<Key extends CollectionKey, Value extends CollectionValue>(
        row: CollectionRow<Key, Value>,
        update: (current: Value) => Value,
    ): void
    update<Value>(atom: Atom<Value>, update: AtomUpdater<Value>): void
    reset<Key extends CollectionKey, Value extends CollectionValue>(
        row: CollectionRow<Key, Value>,
    ): void
    reset<Value>(atom: Atom<Value>): void
    delete<Key extends CollectionKey, Value extends CollectionValue>(
        row: CollectionRow<Key, Value>,
    ): void
    scope(target: string | CommittedStoreTree): RootTransaction
    scope<Result>(
        target: string | CommittedStoreTree,
        callback: TransactionCallback<Result>,
    ): Result
}

type SynchronousTransactionResult<Result> =
    Result extends PromiseLike<unknown> ? never : Result

export type TransactionCallback<Result> = (
    transaction: RootTransaction,
) => SynchronousTransactionResult<Result>

/**
 * The deliberately small committed-host seam. It is internal source, not the
 * public Store API, and grows only when a later reviewed kernel slice lands.
 */
export interface CommittedStoreTree {
    readonly get: <Value>(state: State<Value>) => Value
    readonly sub: <Value>(
        state: State<Value>,
        callback: () => void,
    ) => () => void
    readonly set: {
        <Key extends CollectionKey, Value extends CollectionValue>(
            row: CollectionRow<Key, Value>,
            value: Value,
        ): void
        <Value>(atom: Atom<Value>, value: Value): void
    }
    readonly update: {
        <Key extends CollectionKey, Value extends CollectionValue>(
            row: CollectionRow<Key, Value>,
            update: (current: Value) => Value,
        ): void
        <Value>(atom: Atom<Value>, update: AtomUpdater<Value>): void
    }
    readonly reset: {
        <Key extends CollectionKey, Value extends CollectionValue>(
            row: CollectionRow<Key, Value>,
        ): void
        <Value>(atom: Atom<Value>): void
    }
    readonly delete: <Key extends CollectionKey, Value extends CollectionValue>(
        row: CollectionRow<Key, Value>,
    ) => void
    readonly txn: <Result>(
        callback: TransactionCallback<Result>,
        name?: string,
    ) => Result
    readonly scope: {
        (): CommittedStoreTree
        (id: string): CommittedStoreTree
    }
    readonly dispose: () => void
}

/** @internal The exact peer-owned operations exposed by the v1 adapter seam. */
export interface CommittedStoreTreeAdapter {
    readonly assertStore: (
        value: unknown,
    ) => asserts value is CommittedStoreTree
    readonly read: <Value>(
        store: CommittedStoreTree,
        state: State<Value>,
    ) => Value
    readonly subscribe: <Value>(
        store: CommittedStoreTree,
        state: State<Value>,
        callback: () => void,
    ) => () => void
    readonly readHydrationSnapshot: <Value>(
        store: CommittedStoreTree,
        state: State<Value>,
    ) => Value
}

export interface CommittedStoreTreeDomain {
    atom<Value>(fallback: Value, options?: AtomOptions<Value>): Atom<Value>
    atomLazy<Value>(
        initialize: () => Value,
        options?: AtomOptions<Value>,
    ): Atom<Value>
    selector<Value>(
        get: (get: StateRead) => Value,
        options?: SelectorOptions<Value>,
    ): Selector<Value>
    createStoreTree(): CommittedStoreTree
    readonly adapter: CommittedStoreTreeAdapter
}
