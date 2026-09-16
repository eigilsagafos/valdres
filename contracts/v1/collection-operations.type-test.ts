/**
 * Compile-only spelling authority for the collection foundation and the later
 * stable standalone collection operations.
 *
 * The current slice admits definition-time scalar equality indexes and weakly
 * canonical standalone query States. The broader materialization, scan, and
 * artifact operations below remain deferred target-v1 coordinates.
 */

declare const stateValueBrand: unique symbol
declare const collectionTypesBrand: unique symbol
declare const collectionOptionTypesBrand: unique symbol
declare const storeBrand: unique symbol
declare const transactionBrand: unique symbol
declare const indexBrand: unique symbol
declare const queryBrand: unique symbol
declare const materializationBrand: unique symbol
declare const materializationStatusBrand: unique symbol
declare const artifactBrand: unique symbol

type CollectionKeyCandidate = string | number | bigint | boolean | null
type CollectionValueCandidate =
    | null
    | boolean
    | number
    | bigint
    | string
    | symbol
    | object

interface StateBaseCandidate<Value> {
    readonly [stateValueBrand]: (value: Value) => Value
}

interface AtomCandidate<Value> extends StateBaseCandidate<Value> {
    readonly kind: "atom"
}

interface SelectorCandidate<Value> extends StateBaseCandidate<Value> {
    readonly kind: "selector"
}

interface ReadonlyStateCandidate<
    Value,
    Kind extends "collection-row" | "collection",
> extends StateBaseCandidate<Value> {
    readonly kind: Kind
}

type StateCandidate<Value> =
    | AtomCandidate<Value>
    | SelectorCandidate<Value>
    | ReadonlyStateCandidate<Value, "collection-row">
    | ReadonlyStateCandidate<Value, "collection">

// Family admission deliberately remains narrower than the readable State.
type DefinitionStateCandidate<Value> =
    | AtomCandidate<Value>
    | SelectorCandidate<Value>

interface CollectionRowCandidate<
    Key extends CollectionKeyCandidate,
    Value extends CollectionValueCandidate,
> extends ReadonlyStateCandidate<Value | undefined, "collection-row"> {
    readonly kind: "collection-row"
    readonly key: Key
}

interface CollectionCandidate<
    Key extends CollectionKeyCandidate,
    Value extends CollectionValueCandidate,
    Input = Key,
    Indexes = never,
> extends ReadonlyStateCandidate<
        readonly CollectionRowCandidate<Key, Value>[],
        "collection"
    > {
    readonly kind: "collection"
    readonly [collectionTypesBrand]: {
        readonly key: Key
        readonly value: Value
        readonly indexes: Indexes
        readonly input: Input
    }
    (input: Input): CollectionRowCandidate<Key, Value>
}

interface CollectionOptionCarrierCandidate<
    Key extends CollectionKeyCandidate,
    Value extends CollectionValueCandidate,
    Input,
> {
    readonly name?: string
    readonly [collectionOptionTypesBrand]?: {
        readonly key: (key: Key) => Key
        readonly value: (value: Value) => Value
        readonly input: (input: Input) => Input
    }
}

type RequiredStringIndexNamesCandidate<Indexes> = {
    [Name in keyof Indexes]-?: Name extends string
        ? {} extends Pick<Indexes, Name>
            ? never
            : Name
        : never
}[keyof Indexes]
type CollectionIndexSchemaCandidate<Indexes> = {
    [Name in keyof Indexes]-?: CollectionKeyCandidate
} & (keyof Indexes extends RequiredStringIndexNamesCandidate<Indexes>
    ? unknown
    : never)

type CollectionOptionsCandidate<
    Key extends CollectionKeyCandidate,
    Value extends CollectionValueCandidate,
    Input = Key,
    Indexes extends CollectionIndexSchemaCandidate<Indexes> = never,
> = CollectionOptionCarrierCandidate<Key, Value, Input> &
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

declare function collectionCandidate<
    Key extends CollectionKeyCandidate,
    Value extends CollectionValueCandidate,
>(
    options?: CollectionOptionsCandidate<Key, Value, Key>,
): CollectionCandidate<Key, Value, Key>

declare function collectionCandidate<
    Key extends CollectionKeyCandidate,
    Value extends CollectionValueCandidate,
    Input,
    Indexes extends CollectionIndexSchemaCandidate<Indexes> = never,
>(
    options: CollectionOptionsCandidate<Key, Value, Input, Indexes>,
): CollectionCandidate<Key, Value, Input, Indexes>

declare function presenceCandidate<
    Key extends CollectionKeyCandidate,
    Value extends CollectionValueCandidate,
>(row: CollectionRowCandidate<Key, Value>): SelectorCandidate<boolean>

interface StoreCandidate {
    readonly [storeBrand]: true
    get<Value>(state: StateCandidate<Value>): Value
    sub<Value>(state: StateCandidate<Value>, callback: () => void): () => void
    set<
        Key extends CollectionKeyCandidate,
        Value extends CollectionValueCandidate,
    >(
        row: CollectionRowCandidate<Key, Value>,
        value: Value,
    ): void
    set<Value>(atom: AtomCandidate<Value>, value: Value): void
    update<
        Key extends CollectionKeyCandidate,
        Value extends CollectionValueCandidate,
    >(
        row: CollectionRowCandidate<Key, Value>,
        updater: (current: Value) => Value,
    ): void
    update<Value>(
        atom: AtomCandidate<Value>,
        updater: (current: Value) => Value,
    ): void
    reset<
        Key extends CollectionKeyCandidate,
        Value extends CollectionValueCandidate,
    >(
        row: CollectionRowCandidate<Key, Value>,
    ): void
    reset<Value>(atom: AtomCandidate<Value>): void
    delete<
        Key extends CollectionKeyCandidate,
        Value extends CollectionValueCandidate,
    >(
        row: CollectionRowCandidate<Key, Value>,
    ): void
}

interface TransactionCandidate {
    readonly [transactionBrand]: true
    get<Value>(state: StateCandidate<Value>): Value
    set<
        Key extends CollectionKeyCandidate,
        Value extends CollectionValueCandidate,
    >(
        row: CollectionRowCandidate<Key, Value>,
        value: Value,
    ): void
    set<Value>(atom: AtomCandidate<Value>, value: Value): void
    update<
        Key extends CollectionKeyCandidate,
        Value extends CollectionValueCandidate,
    >(
        row: CollectionRowCandidate<Key, Value>,
        updater: (current: Value) => Value,
    ): void
    update<Value>(
        atom: AtomCandidate<Value>,
        updater: (current: Value) => Value,
    ): void
    reset<
        Key extends CollectionKeyCandidate,
        Value extends CollectionValueCandidate,
    >(
        row: CollectionRowCandidate<Key, Value>,
    ): void
    reset<Value>(atom: AtomCandidate<Value>): void
    delete<
        Key extends CollectionKeyCandidate,
        Value extends CollectionValueCandidate,
    >(
        row: CollectionRowCandidate<Key, Value>,
    ): void
}

interface SessionCandidate {
    readonly userId: string
}

interface SessionLookupCandidate {
    readonly ref: string
}

declare const store: StoreCandidate
declare const transaction: TransactionCandidate
declare const countAtom: AtomCandidate<number>

const sessions = collectionCandidate<string, SessionCandidate>()
const sessionsWithDirectEncoder = collectionCandidate<string, SessionCandidate>(
    { encodeKey: input => input },
)
const richSessions = collectionCandidate<
    string,
    SessionCandidate,
    SessionLookupCandidate
>({ encodeKey: input => input.ref })
const sessionRow = sessions("session-1")
const richSessionRow = richSessions({ ref: "session-1" })
const sessionPresence = presenceCandidate(sessionRow)

function classifyState(
    state: StateCandidate<number>,
): StateCandidate<number>["kind"] {
    if (state.kind === "atom") {
        const atomState: AtomCandidate<number> = state
        return atomState.kind
    }
    if (state.kind === "selector") {
        const selectorState: SelectorCandidate<number> = state
        return selectorState.kind
    }
    if (state.kind === "collection-row") return state.kind
    return state.kind
}

const directBinding: CollectionCandidate<
    string,
    SessionCandidate,
    string,
    never
> = sessions
const richBinding: CollectionCandidate<
    string,
    SessionCandidate,
    SessionLookupCandidate,
    never
> = richSessions
const rowBinding: CollectionRowCandidate<string, SessionCandidate> = sessionRow
const rowValue: SessionCandidate | undefined = store.get(sessionRow)
const collectionValue: readonly CollectionRowCandidate<
    string,
    SessionCandidate
>[] = store.get(sessions)
const presenceValue: boolean = store.get(sessionPresence)

store.set(sessionRow, { userId: "user-1" })
store.update(sessionRow, current => ({ ...current, userId: "user-2" }))
store.reset(sessionRow)
store.delete(sessionRow)
transaction.set(richSessionRow, { userId: "user-1" })
transaction.update(richSessionRow, current => current)
transaction.reset(richSessionRow)
transaction.delete(richSessionRow)

type FunctionValueCandidate = () => string
const functionValues = collectionCandidate<string, FunctionValueCandidate>()
const functionRow = functionValues("function")
const functionValue: FunctionValueCandidate = () => "stored"
store.set(functionRow, functionValue)

declare const narrowState: StateCandidate<"literal">
// @ts-expect-error the private State value coordinate is invariant
const widenedState: StateCandidate<string> = narrowState

declare function admitFamilyState<Value>(
    state: DefinitionStateCandidate<Value>,
): void
admitFamilyState(countAtom)
// @ts-expect-error family factories cannot return collection rows
admitFamilyState(sessionRow)
// @ts-expect-error family factories cannot return collection definitions
admitFamilyState(sessions)

// @ts-expect-error rich lookup input requires encodeKey
collectionCandidate<string, SessionCandidate, SessionLookupCandidate>({})
// @ts-expect-error untyped collection rejects index declarations
collectionCandidate<string, SessionCandidate>({ indexes: { byUser: true } })
// @ts-expect-error CollectionOptions rejects unknown options
collectionCandidate<string, SessionCandidate>({ storage: "global" })
// @ts-expect-error undefined is the reserved row-absence value
collectionCandidate<string, SessionCandidate | undefined>()
// @ts-expect-error collection keys exclude symbol and undefined
collectionCandidate<symbol, SessionCandidate>()
// @ts-expect-error row set cannot store the reserved absence value
store.set(sessionRow, undefined)
// @ts-expect-error row updater cannot produce the reserved absence value
store.update(sessionRow, () => undefined)
// @ts-expect-error Atom is not a collection-row deletion target
store.delete(countAtom)
// @ts-expect-error a readonly collection is not a row mutation target
store.set(sessions, [])
// @ts-expect-error a readonly collection is not a row mutation target
transaction.delete(sessions)
// @ts-expect-error presence accepts collection rows only
presenceCandidate(sessions)

void sessionsWithDirectEncoder
void directBinding
void richBinding
void rowBinding
void rowValue
void collectionValue
void presenceValue
void functionValue
void widenedState
void classifyState

interface StructuralIndexCandidate {
    readonly [indexBrand]: true
}

interface StructuralQueryCandidate<Result> {
    readonly [queryBrand]: Result
}

interface MaterializationHandleCandidate {
    readonly [materializationBrand]: true
}

type MaterializationPriorityCandidate = "user-visible" | "background"

interface MaterializeOptionsCandidate {
    readonly priority?: MaterializationPriorityCandidate
}

interface ArtifactPlaceholder {
    readonly [artifactBrand]: true
}

interface MaterializationStatusCandidate {
    readonly [materializationStatusBrand]: true
}

interface CollectionOperationsCandidate {
    materialize(
        store: StoreCandidate,
        index: StructuralIndexCandidate,
        options?: MaterializeOptionsCandidate,
    ): MaterializationHandleCandidate
    scan<Result>(
        target: StoreCandidate | TransactionCandidate,
        query: StructuralQueryCandidate<Result>,
    ): Result
    getMaterializationStatus(
        materialization: MaterializationHandleCandidate,
    ): MaterializationStatusCandidate
    subscribeMaterialization(
        materialization: MaterializationHandleCandidate,
        listener: (status: MaterializationStatusCandidate) => void,
    ): () => void
}

interface CollectionArtifactsCandidate {
    exportArtifact(
        materialization: MaterializationHandleCandidate,
    ): ArtifactPlaceholder
    importArtifact(
        store: StoreCandidate,
        index: StructuralIndexCandidate,
        artifact: ArtifactPlaceholder,
    ): MaterializationHandleCandidate
}

declare const index: StructuralIndexCandidate
declare const query: StructuralQueryCandidate<
    Readonly<{ rows: readonly string[]; total: number }>
>
declare const collectionOperations: CollectionOperationsCandidate
declare const collectionArtifacts: CollectionArtifactsCandidate

const stableModules = {
    "valdres/collection": collectionOperations,
    "valdres/collection/artifacts": collectionArtifacts,
} as const

const operations = stableModules["valdres/collection"]
const artifacts = stableModules["valdres/collection/artifacts"]

const materialization = operations.materialize(store, index)
const withUserVisiblePriority = operations.materialize(store, index, {
    priority: "user-visible",
})
const withBackgroundPriority = operations.materialize(store, index, {
    priority: "background",
})
const committedResult = operations.scan(store, query)
const draftResult = operations.scan(transaction, query)
const status = operations.getMaterializationStatus(materialization)
const unsubscribe = operations.subscribeMaterialization(
    materialization,
    nextStatus => {
        const sameSnapshot: MaterializationStatusCandidate = nextStatus
        void sameSnapshot
    },
)
const artifact = artifacts.exportArtifact(materialization)
const imported: typeof materialization = artifacts.importArtifact(
    store,
    index,
    artifact,
)

void withUserVisiblePriority
void withBackgroundPriority
void committedResult
void draftResult
void status
void unsubscribe
void imported

// @ts-expect-error materialization is a standalone subpath operation, not a Store method
store.materialize(index)
// @ts-expect-error a Transaction is a scan target, not a materialization owner
operations.materialize(transaction, index)
// @ts-expect-error materialization priority is exactly the frozen two-literal union
operations.materialize(store, index, { priority: "low" })
// @ts-expect-error no user-blocking materialization tier is frozen
operations.materialize(store, index, { priority: "user-blocking" })
// @ts-expect-error scheduler callbacks are outside the stable options bag
operations.materialize(store, index, { scheduler: () => undefined })
// @ts-expect-error scan accepts a structural query, not an index definition
operations.scan(store, index)
// @ts-expect-error progress is represented only through status; there is no separate progress export
operations.progress(materialization)
// @ts-expect-error import is Store-owned and cannot target a Transaction
artifacts.importArtifact(transaction, index, artifact)
// @ts-expect-error export consumes a materialization handle, not an index definition
artifacts.exportArtifact(index)

// Executable public type compatibility, not only a parallel candidate spelling.
import {
    collection as publicCollection,
    type State,
    type CollectionRow,
} from "../../packages/valdres/src/index"
import { query as publicQuery } from "../../packages/valdres/src/query"
interface Entity {
    kind: "task" | "person"
}
interface EntityIndexes {
    kind: Entity["kind"]
}
const indexed = publicCollection<string, Entity, string, EntityIndexes>({
    name: "entities",
    indexes: { kind: entity => entity.kind },
})
const tasks: State<readonly CollectionRow<string, Entity>[]> = publicQuery(
    indexed,
    { where: { kind: { eq: "task" } } },
)
// @ts-expect-error Declared index values must be scalar.
publicCollection<string, Entity, string, { kind: object }>({
    indexes: { kind: (entity: Entity) => entity },
})
// @ts-expect-error Scalar query literals retain their declared union.
publicQuery(indexed, { where: { kind: { eq: "unknown" } } })
// @ts-expect-error Compound operations remain outside the current slice.
publicQuery(indexed, { where: { kind: { eq: "task" } }, limit: 10 })
void tasks
