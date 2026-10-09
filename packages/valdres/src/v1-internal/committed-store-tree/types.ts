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

// The public atom, atom.lazy and selector factories type `options.equal`
// through these aliases so that Value comes from the initial value,
// initializer or read function alone. Each is exactly Value once Value is
// known, so the comparator is still checked against, and contextually typed
// by, Value. Without them, `atom(untyped, { equal: deepEqual })` inferred
// `Atom<unknown>` on TypeScript 5.6+ and `atom(0, { equal: numberEqual })`
// inferred `Atom<0>`. Backing tests:
// test/v1-public-candidate/comparator-inference.test-d.ts.
//
// Both aliases are plain conditional / indexed-access types so the published
// declarations keep type-checking on TypeScript releases before 5.4, which
// lack the `NoInfer` utility (verified from 4.9 against the installed
// declarations). `NoInfer<Value>` in all three signatures was also tried on
// TypeScript 5.9.2 and rejected `selector(get => get(count), { equal:
// numberEqual })` and a predeclared `SelectorOptions` object with "not
// assignable to EqualFunc<unknown>" (NamedComparatorCases).

// Eager atom: blocks inference from the comparator entirely. Its initial value
// is a top-level argument, and any comparator inference, even a discarded
// lower-priority one, stopped `atom(1, ...)` from widening to number
// (LiteralCases, NamedComparatorCases).
export type UninferredValue<Value> = [Value][Value extends unknown ? 0 : never]

// atom.lazy and selector: still infers from the comparator, but below the
// initializer or read function, so the function's result wins (AnyCases,
// rejected) while a named comparator next to a context-sensitive `get => ...`
// function still type-checks (NamedComparatorCases).
export type ComparatorValue<Value> = [Value] extends [unknown] ? Value : never

export type AtomUpdater<Value> = (current: Value) => Value

/** A scope-bound revocable view over one internal StoreTree draft. */
export interface RootTransaction {
    /**
     * Experimental. Start callback after this draft commits and synchronous
     * settlement/notification restrictions unwind. Successful no-ops deliver;
     * aborts discard. Later post-apply errors do not discard committed work.
     *
     * This cursor's scope owns pending lifetime: disposal cancels unstarted
     * work; scope(root).onCommit(...) chooses root lifetime without changing
     * the enclosing draft's rollback boundary. resetAll does not cancel it.
     *
     * Starts are FIFO, not asynchronous completions. Delivery is deferred to
     * a microtask, with task yields under load; browser activation is not
     * guaranteed. Fake timers may pause delivery until advanced. If the host
     * discards a wake, a later registration under functioning scheduling
     * restarts pending work. Returned promises are observed, not awaited.
     * Throws/rejections use host reportError (or an uncaught task fallback),
     * never the originating transaction's error channel. The cursor is closed
     * by execution time. Registration returns void, not a cancellation handle.
     */
    onCommit(callback: () => unknown): void
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
    /**
     * Experimental. Stages `reset` for every Atom and collection row this
     * child-scope cursor owns in its draft view, including writes staged
     * earlier in this transaction, so the scope inherits as an untouched child
     * of its parent: in every collection, membership follows the parent's
     * order, and later writes in the transaction order as they would in an
     * untouched child. Descendants keep their own overrides; a descendant
     * that mirrored the scope's rows, stages no row change of its own and
     * whose own rows agree keeps mirroring it. Takes no arguments; throws a
     * TypeError on a root cursor.
     */
    resetAll(): void
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
         * ordinary subscribers are notified; `notify` observes it afterwards,
         * including after a failed `settle`. Registration never runs `settle`.
         * One unsubscribe removes both.
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
