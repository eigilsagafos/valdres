import type {
    CollectionId,
    EffectiveRowDelta,
    RowId,
    ScopeId,
    TreeId,
    ValueToken,
} from "../../v1-model/index"

export interface IndexTarget {
    readonly tree: TreeId
    readonly scope: ScopeId
    readonly collection: CollectionId
}

export interface CheckpointRow {
    readonly row: RowId
    readonly value: ValueToken
}

/** A frozen, commit-final scan owned by the collection reference model host. */
export interface CollectionCheckpoint extends IndexTarget {
    readonly epoch: number
    /** Portable digest of ordered row identities and semantic values. */
    readonly logicalCheckpoint: string
    readonly rows: readonly CheckpointRow[]
}

export interface IndexDefinition extends IndexTarget {
    /** Experimental identity only; this is intentionally not proposed API. */
    readonly experimentalId: string
    readonly fingerprint: string
    /** Used only by the cancellable baseline scan, never after source commit. */
    readonly project: IndexProjector
}

export type IndexProjector = (row: RowId, value: ValueToken) => string

export interface IndexBucket {
    readonly key: string
    readonly rows: readonly RowId[]
}

export interface IndexSnapshot extends IndexTarget {
    readonly generation: number
    readonly buckets: readonly IndexBucket[]
}

export type BuildFailureCode =
    | "BUILD_FAILED"
    | "DELTA_SEQUENCE_ERROR"
    | "DELTA_CONTRACT_ERROR"

export type ArtifactRejectionCode =
    | "ARTIFACT_TARGET_MISMATCH"
    | "ARTIFACT_DEFINITION_MISMATCH"
    | "STALE_ARTIFACT"
    | "CORRUPT_ARTIFACT"

export type OperationStatus =
    | Readonly<{
          state: "unmaterialized"
          generation: 0
          progress: Readonly<{ completed: 0; total: 0 }>
      }>
    | Readonly<{
          state: "building"
          generation: number
          progress: Readonly<{ completed: number; total: number }>
          throughEpoch: number
      }>
    | Readonly<{
          state: "ready"
          generation: number
          progress: Readonly<{ completed: number; total: number }>
          throughEpoch: number
      }>
    | Readonly<{
          state: "failed"
          generation: number
          progress: Readonly<{ completed: number; total: number }>
          throughEpoch: number
          code: BuildFailureCode
          message: string
      }>
    | Readonly<{
          state: "cancelled"
          generation: number
          progress: Readonly<{ completed: number; total: number }>
          throughEpoch: number
          reason: string
      }>

export type WakeableState =
    | Readonly<{ state: "pending" }>
    | Readonly<{ state: "fulfilled"; snapshot: IndexSnapshot }>
    | Readonly<{ state: "rejected"; reason: string }>

export interface BuildWakeable {
    readonly generation: number
    inspect(): WakeableState
    then(
        onFulfilled?: (snapshot: IndexSnapshot) => void,
        onRejected?: (reason: string) => void,
    ): void
}

export type DemandResult =
    | Readonly<{ state: "building"; wakeable: BuildWakeable }>
    | Readonly<{ state: "ready"; snapshot: IndexSnapshot }>

export interface PreparedIndexDelta extends EffectiveRowDelta {
    readonly beforeKey?: string
    readonly afterKey?: string
}

export interface PreparedCollectionCommit {
    readonly tree: TreeId
    readonly epoch: number
    readonly definitionFingerprint: string
    readonly deltas: readonly PreparedIndexDelta[]
}

export interface IndexArtifact {
    readonly format: "valdres-index-operations-spike-v1"
    readonly collection: CollectionId
    readonly definitionFingerprint: string
    readonly logicalCheckpoint: string
    readonly rows: readonly Readonly<{
        row: RowId
        value: ValueToken
        key: string
    }>[]
    readonly checksum: string
}

/**
 * Host-prepared artifact-to-target transformation at the artifact's base
 * checkpoint. Every source or target row has one preconditioned delta, so the
 * operational machine can start from artifact data, validate its prepared
 * keys, and reconcile scope differences without Store reads or projection.
 */
export interface PreparedScopeOverlay {
    readonly collection: CollectionId
    readonly definitionFingerprint: string
    readonly sourceLogicalCheckpoint: string
    readonly targetLogicalCheckpoint: string
    readonly targetOrder: readonly RowId[]
    readonly deltas: readonly PreparedIndexDelta[]
}

export interface ArtifactImportPlan {
    readonly artifact: IndexArtifact
    /** Target-local view at the artifact-era epoch. */
    readonly baseCheckpoint: CollectionCheckpoint
    /** Prepared artifact/root-to-target-scope reconciliation at that epoch. */
    readonly baseOverlay: PreparedScopeOverlay
    /** Every later target-tree epoch, already prepared for this definition. */
    readonly laterCommits: readonly PreparedCollectionCommit[]
    /** Commit-final target-local view after replaying laterCommits. */
    readonly targetCheckpoint: CollectionCheckpoint
}

export type OperationEvent =
    | Readonly<{
          kind: "build-started"
          generation: number
          baselineEpoch: number
          total: number
      }>
    | Readonly<{
          kind: "progress"
          generation: number
          completed: number
          total: number
      }>
    | Readonly<{
          kind: "commit-journaled"
          generation: number
          epoch: number
          relevantDeltas: number
      }>
    | Readonly<{
          kind: "published"
          generation: number
          throughEpoch: number
          source: "build" | "delta" | "artifact"
      }>
    | Readonly<{
          kind: "failed"
          generation: number
          code: BuildFailureCode
      }>
    | Readonly<{
          kind: "cancelled"
          generation: number
          reason: string
      }>
    | Readonly<{
          kind: "artifact-rejected"
          code: ArtifactRejectionCode
      }>

export type ArtifactImportResult =
    | Readonly<{ ok: true; snapshot: IndexSnapshot }>
    | Readonly<{ ok: false; error: ArtifactRejectionCode }>
