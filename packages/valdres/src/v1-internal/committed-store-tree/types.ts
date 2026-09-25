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

/** A read-only definition projecting synchronous, externally owned truth. */
export interface ExternalAtom<Value> extends StateBase<Value> {
    readonly kind: "external"
}

/** Structural source whose methods run with the original source receiver. */
export interface ExternalSource<Value> {
    readonly getSnapshot: () => Value
    readonly getServerSnapshot?: () => Value
    readonly subscribe: (invalidate: () => void) => () => void
}

/** Optional inert diagnostic name; equality is always Object.is. */
export interface ExternalAtomOptions {
    readonly name?: string
}

/** Any definition that can be read and subscribed through a Store. */
export type State<Value> =
    | Atom<Value>
    | Selector<Value>
    | ExternalAtom<Value>
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
    readonly name?: string
    readonly [privateCollectionOptionTypes]?: {
        readonly key: (key: Key) => Key
        readonly value: (value: Value) => Value
        readonly input: (input: Input) => Input
    }
}

/** Names must be required literal strings, not optional keys or index signatures. */
type RequiredStringIndexNames<Indexes> = {
    [Name in keyof Indexes]-?: Name extends string
        ? {} extends Pick<Indexes, Name>
            ? never
            : Name
        : never
}[keyof Indexes]

/** @internal Shared constraint for the finite, required scalar extractor map. */
export type CollectionIndexSchema<Indexes> = {
    [Name in keyof Indexes]-?: CollectionKey
} & (keyof Indexes extends RequiredStringIndexNames<Indexes> ? unknown : never)

/** Definition-time options for canonical or rich-input Collection keys. */
export type CollectionOptions<
    Key extends CollectionKey,
    Value extends CollectionValue,
    Input = Key,
    Indexes extends CollectionIndexSchema<Indexes> = never,
> = CollectionOptionCarrier<Key, Value, Input> &
    ([Indexes] extends [never]
        ? { readonly indexes?: never }
        : {
              readonly indexes: {
                  readonly [Name in keyof Indexes]: (
                      value: Value,
                  ) => Indexes[Name]
              }
          }) &
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
 * Phase-keyed `Store.sub` handlers; at least one is required. `settle` runs as
 * its own synchronous transaction after derived state propagates and before
 * any `notify` runs; `notify` is an ordinary subscriber.
 */
export type SubscriptionHandlers<Result = void> =
    | {
          readonly settle: TransactionCallback<Result>
          readonly notify?: () => void
      }
    | { readonly settle?: undefined; readonly notify: () => void }

/**
 * The deliberately small committed-host seam. It is internal source, not the
 * public Store API, and grows only when a later reviewed kernel slice lands.
 */
export interface CommittedStoreTree {
    readonly get: <Value>(state: State<Value>) => Value
    readonly sub: {
        <Value>(state: State<Value>, callback: () => void): () => void
        /**
         * When a settlement changes `state`, `settle` writes inside it, before
         * ordinary subscribers are notified; `notify` observes it afterwards.
         * Registration never runs `settle`. One unsubscribe removes both.
         */
        <Value, Result = void>(
            state: State<Value>,
            handlers: SubscriptionHandlers<Result>,
        ): () => void
    }
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
