import {
    createCommittedStoreTreeDomain,
    type Atom as InternalAtom,
    type AtomUpdater,
    type CommittedStoreTree,
    type RootTransaction,
    type Selector as InternalSelector,
    type State as InternalState,
    type StateRead,
    type TransactionCallback,
} from "./v1-internal/committed-store-tree/committed-store-tree"

export type Atom<Value> = InternalAtom<Value>
export type Selector<Value> = InternalSelector<Value>
export type State<Value> = InternalState<Value>
export type Store = CommittedStoreTree
export type Transaction = RootTransaction

export type { AtomUpdater, StateRead, TransactionCallback }

export interface AtomOptions<Value> {
    readonly name?: string
    readonly equal?: (previous: Value, next: Value) => boolean
}

export interface SelectorOptions<Value> {
    readonly name?: string
    readonly equal?: (previous: Value, next: Value) => boolean
}

export interface AtomFactory {
    <Value>(initial: Value, options?: AtomOptions<Value>): Atom<Value>
    readonly lazy: <Value>(
        initialize: () => Value,
        options?: AtomOptions<Value>,
    ) => Atom<Value>
}

const domain = createCommittedStoreTreeDomain()

const atomLazy = <Value>(
    initialize: () => Value,
    options: AtomOptions<Value> = {},
): Atom<Value> => domain.atomLazy(initialize, options)

const atomEager = <Value>(
    initial: Value,
    options: AtomOptions<Value> = {},
): Atom<Value> => domain.atom(initial, options)

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
): Selector<Value> => domain.selector(read, options)

export function store(): Store {
    if (arguments.length !== 0) {
        throw new TypeError("store() accepts no arguments")
    }
    return domain.createStoreTree()
}
