/**
 * Compile-only spelling spike for the stable standalone collection operations.
 *
 * The manifest owns the real package/subpath names. These placeholders prove
 * only the accepted call relationships. They intentionally do not freeze the
 * materialization option members, scheduler, diagnostics,
 * artifact bytes, codec, persistence, or async execution strategy.
 */

declare const storeBrand: unique symbol
declare const transactionBrand: unique symbol
declare const indexBrand: unique symbol
declare const queryBrand: unique symbol
declare const materializationBrand: unique symbol
declare const materializationStatusBrand: unique symbol
declare const materializeOptionsBrand: unique symbol
declare const artifactBrand: unique symbol

interface StoreCandidate {
    readonly [storeBrand]: true
}

interface TransactionCandidate {
    readonly [transactionBrand]: true
}

interface StructuralIndexCandidate {
    readonly [indexBrand]: true
}

interface StructuralQueryCandidate<Result> {
    readonly [queryBrand]: Result
}

interface MaterializationHandleCandidate {
    readonly [materializationBrand]: true
}

interface MaterializeOptionsPlaceholder {
    readonly [materializeOptionsBrand]?: never
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
        options?: MaterializeOptionsPlaceholder,
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

declare const store: StoreCandidate
declare const transaction: TransactionCandidate
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
const withReservedOptions = operations.materialize(store, index, {})
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

void withReservedOptions
void committedResult
void draftResult
void status
void unsubscribe
void imported

// @ts-expect-error materialization is a standalone subpath operation, not a Store method
store.materialize(index)
// @ts-expect-error a Transaction is a scan target, not a materialization owner
operations.materialize(transaction, index)
// @ts-expect-error scheduler and priority option keys are deliberately not frozen
operations.materialize(store, index, { priority: "low" })
// @ts-expect-error scan accepts a structural query, not an index definition
operations.scan(store, index)
// @ts-expect-error progress is represented only through status; there is no separate progress export
operations.progress(materialization)
// @ts-expect-error import is Store-owned and cannot target a Transaction
artifacts.importArtifact(transaction, index, artifact)
// @ts-expect-error export consumes a materialization handle, not an index definition
artifacts.exportArtifact(index)
