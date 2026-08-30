declare const stateValue: unique symbol

/** A StoreTree-local writable cell definition. The handle itself owns no value. */
export interface Atom<Value> {
    readonly kind: "atom"
    /** @internal Invariant type marker; no runtime property is installed. */
    readonly [stateValue]: (value: Value) => Value
}

/** A pure synchronous derived-state definition. */
export interface Selector<Value> {
    readonly kind: "selector"
    /** @internal Invariant type marker; no runtime property is installed. */
    readonly [stateValue]: (value: Value) => Value
}

export type State<Value> = Atom<Value> | Selector<Value>

export type StateRead = <Value>(state: State<Value>) => Value

export interface AtomOptions<Value> {
    readonly equal?: (previous: Value, next: Value) => boolean
}

export interface SelectorOptions<Value> {
    readonly equal?: (previous: Value, next: Value) => boolean
}

export type AtomUpdater<Value> = (current: Value) => Value

/** A scope-bound revocable view over one internal StoreTree draft. */
export interface RootTransaction {
    get<Value>(state: State<Value>): Value
    set<Value>(atom: Atom<Value>, value: Value): void
    update<Value>(atom: Atom<Value>, update: AtomUpdater<Value>): void
    reset<Value>(atom: Atom<Value>): void
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
    readonly set: <Value>(atom: Atom<Value>, value: Value) => void
    readonly update: <Value>(
        atom: Atom<Value>,
        update: AtomUpdater<Value>,
    ) => void
    readonly reset: <Value>(atom: Atom<Value>) => void
    readonly txn: <Result>(callback: TransactionCallback<Result>) => Result
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
