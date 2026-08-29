import { tokenObjectIs } from "../../v1-model/index"
import type { RowId, ValueToken } from "../../v1-model/index"
import type { ManualScheduler } from "./manual-scheduler"
import {
    assertPreparedIndexKey,
    checksum,
    encodeValueToken,
    logicalCheckpointFor,
    runIndexProjector,
} from "./preparation"
import type {
    ArtifactImportPlan,
    ArtifactImportResult,
    ArtifactRejectionCode,
    BuildFailureCode,
    BuildWakeable,
    CollectionCheckpoint,
    DemandResult,
    IndexArtifact,
    IndexDefinition,
    IndexSnapshot,
    OperationEvent,
    OperationStatus,
    PreparedCollectionCommit,
    PreparedIndexDelta,
    PreparedScopeOverlay,
    WakeableState,
} from "./types"

interface Candidate {
    readonly order: RowId[]
    readonly keys: Map<RowId, string>
    readonly values: Map<RowId, ValueToken>
}

interface ActiveBuild {
    readonly generation: number
    readonly checkpoint: CollectionCheckpoint
    readonly candidate: Candidate
    readonly journal: PreparedCollectionCommit[]
    readonly wakeable: ControlledWakeable
    completed: number
    throughEpoch: number
}

interface ActiveProjectorInvocation {
    fault?: Error
}

/** Explicit test-domain quarantine shared by every operation instance in it. */
export class ExperimentalIndexOperationDomain {
    private activeProjector: ActiveProjectorInvocation | undefined

    assertOperationalCommandAllowed(): void {
        if (this.activeProjector === undefined) return
        const error = new Error(
            "INDEX_OPERATION_CAPABILITY_ERROR: operational commands are forbidden inside the index projector",
        )
        this.activeProjector.fault ??= error
        throw error
    }

    runProjector<Result>(callback: () => Result): Result {
        this.assertOperationalCommandAllowed()
        const invocation: ActiveProjectorInvocation = {}
        this.activeProjector = invocation
        let result: Result
        try {
            result = callback()
        } finally {
            this.activeProjector = undefined
        }
        if (invocation.fault !== undefined) throw invocation.fault
        return result
    }
}

class ControlledWakeable implements BuildWakeable {
    private state: WakeableState = Object.freeze({ state: "pending" })
    private readonly listeners: Readonly<{
        fulfilled?: (snapshot: IndexSnapshot) => void
        rejected?: (reason: string) => void
    }>[] = []

    constructor(readonly generation: number) {}

    inspect(): WakeableState {
        return this.state
    }

    then(
        onFulfilled?: (snapshot: IndexSnapshot) => void,
        onRejected?: (reason: string) => void,
    ): void {
        if (this.state.state === "fulfilled") {
            onFulfilled?.(this.state.snapshot)
            return
        }
        if (this.state.state === "rejected") {
            onRejected?.(this.state.reason)
            return
        }
        this.listeners.push(
            Object.freeze({
                ...(onFulfilled === undefined
                    ? {}
                    : { fulfilled: onFulfilled }),
                ...(onRejected === undefined ? {} : { rejected: onRejected }),
            }),
        )
    }

    fulfill(snapshot: IndexSnapshot): void {
        if (this.state.state !== "pending") return
        this.state = Object.freeze({ state: "fulfilled", snapshot })
        const listeners = this.listeners.splice(0)
        let firstError: unknown
        let hasError = false
        for (const listener of listeners) {
            try {
                listener.fulfilled?.(snapshot)
            } catch (error) {
                if (!hasError) {
                    firstError = error
                    hasError = true
                }
            }
        }
        if (hasError) throw firstError
    }

    reject(reason: string): void {
        if (this.state.state !== "pending") return
        this.state = Object.freeze({ state: "rejected", reason })
        const listeners = this.listeners.splice(0)
        let firstError: unknown
        let hasError = false
        for (const listener of listeners) {
            try {
                listener.rejected?.(reason)
            } catch (error) {
                if (!hasError) {
                    firstError = error
                    hasError = true
                }
            }
        }
        if (hasError) throw firstError
    }
}

/**
 * Test-only lifecycle state machine. It receives immutable collection-model
 * checkpoints and prepared EffectiveRowDelta commits. It never mutates rows;
 * the guarded index projector runs only while scanning a private baseline
 * candidate. Commit ingestion and artifact import/export consume inert keys.
 */
export class ExperimentalIndexOperations {
    private currentStatus: OperationStatus = Object.freeze({
        state: "unmaterialized",
        generation: 0,
        progress: Object.freeze({ completed: 0, total: 0 }),
    })
    private readonly statusLog: OperationStatus[] = [this.currentStatus]
    private readonly eventLog: OperationEvent[] = []
    private generation = 0
    private build: ActiveBuild | undefined
    private publishedSnapshot: IndexSnapshot | undefined
    private readyCandidate: Candidate | undefined
    private readyThroughEpoch = 0
    private consumedEpochFloor = 0
    private readyProgress: Readonly<{ completed: number; total: number }> =
        Object.freeze({ completed: 0, total: 0 })
    private disposed = false

    constructor(
        private readonly definition: IndexDefinition,
        private readonly scheduler: ManualScheduler,
        private readonly domain: ExperimentalIndexOperationDomain = new ExperimentalIndexOperationDomain(),
    ) {}

    status(): OperationStatus {
        return this.currentStatus
    }

    statusHistory(): readonly OperationStatus[] {
        return Object.freeze([...this.statusLog])
    }

    events(): readonly OperationEvent[] {
        return Object.freeze([...this.eventLog])
    }

    snapshot(): IndexSnapshot | undefined {
        return this.publishedSnapshot
    }

    demand(checkpoint: CollectionCheckpoint): DemandResult {
        this.assertOperationalCommandAllowed()
        this.assertNotDisposed()
        this.assertCheckpointTarget(checkpoint)
        assertCheckpointShape(checkpoint)
        if (this.build !== undefined) {
            if (checkpoint.epoch > this.build.throughEpoch) {
                this.observeEpoch(checkpoint.epoch)
                this.fail(
                    "DELTA_SEQUENCE_ERROR",
                    `Demand observed epoch ${checkpoint.epoch} after build epoch ${this.build.throughEpoch} without prepared commits`,
                )
                throw new Error(
                    "A building index must advance through collection commits, not a replacement demand",
                )
            }
            return Object.freeze({
                state: "building",
                wakeable: this.build.wakeable,
            })
        }
        if (this.publishedSnapshot !== undefined) {
            if (checkpoint.epoch < this.readyThroughEpoch) {
                throw new Error(
                    "A ready index must advance through collection commits, not a replacement demand",
                )
            }
            if (checkpoint.epoch > this.readyThroughEpoch) {
                this.observeEpoch(checkpoint.epoch)
                const expected = this.readyThroughEpoch + 1
                this.failReady(
                    "DELTA_SEQUENCE_ERROR",
                    `Demand observed epoch ${checkpoint.epoch}; expected prepared commit ${expected}`,
                )
                throw new Error(
                    "A ready index must advance through collection commits, not a replacement demand",
                )
            }
            return Object.freeze({
                state: "ready",
                snapshot: this.publishedSnapshot,
            })
        }
        if (
            this.currentStatus.state === "failed" ||
            this.currentStatus.state === "cancelled"
        ) {
            throw new Error("Use retry() after a failed or cancelled build")
        }
        this.assertCheckpointNotBeforeFloor(checkpoint, "Demand")
        return this.start(checkpoint)
    }

    retry(checkpoint: CollectionCheckpoint): DemandResult {
        this.assertOperationalCommandAllowed()
        this.assertNotDisposed()
        this.assertCheckpointTarget(checkpoint)
        assertCheckpointShape(checkpoint)
        if (
            this.currentStatus.state !== "failed" &&
            this.currentStatus.state !== "cancelled"
        ) {
            throw new Error("retry() requires a failed or cancelled build")
        }
        this.assertCheckpointNotBeforeFloor(checkpoint, "Retry")
        return this.start(checkpoint)
    }

    recordCommit(commit: PreparedCollectionCommit): void {
        this.assertOperationalCommandAllowed()
        if (this.disposed || commit.tree !== this.definition.tree) return
        if (!Number.isSafeInteger(commit.epoch) || commit.epoch < 0) {
            this.failActiveOrReady(
                "DELTA_CONTRACT_ERROR",
                "Prepared commit epoch must be a non-negative integer",
            )
            return
        }
        this.observeEpoch(commit.epoch)
        if (commit.definitionFingerprint !== this.definition.fingerprint) {
            this.failActiveOrReady(
                "DELTA_CONTRACT_ERROR",
                "Prepared commit uses another index definition",
            )
            return
        }
        if (this.build !== undefined) {
            const expected = this.build.throughEpoch + 1
            if (commit.epoch !== expected) {
                this.fail(
                    "DELTA_SEQUENCE_ERROR",
                    `Expected epoch ${expected}, received ${commit.epoch}`,
                )
                return
            }
            const relevant = this.relevantDeltas(commit.deltas)
            try {
                this.validatePreparedBatch(relevant)
            } catch {
                this.fail(
                    "DELTA_CONTRACT_ERROR",
                    "Prepared commit failed validation",
                )
                return
            }
            this.build.journal.push(
                Object.freeze({
                    tree: commit.tree,
                    epoch: commit.epoch,
                    definitionFingerprint: commit.definitionFingerprint,
                    deltas: relevant,
                }),
            )
            this.build.throughEpoch = commit.epoch
            this.eventLog.push(
                Object.freeze({
                    kind: "commit-journaled",
                    generation: this.build.generation,
                    epoch: commit.epoch,
                    relevantDeltas: relevant.length,
                }),
            )
            this.setBuildingStatus(this.build)
            return
        }

        if (
            this.currentStatus.state !== "ready" ||
            this.publishedSnapshot === undefined ||
            this.readyCandidate === undefined
        ) {
            return
        }
        const expected = this.readyThroughEpoch + 1
        if (commit.epoch !== expected) {
            this.failReady(
                "DELTA_SEQUENCE_ERROR",
                `Expected epoch ${expected}, received ${commit.epoch}`,
            )
            return
        }
        const relevant = this.relevantDeltas(commit.deltas)
        try {
            this.validatePreparedBatch(relevant)
        } catch {
            this.failReady(
                "DELTA_CONTRACT_ERROR",
                "Prepared commit failed validation",
            )
            return
        }
        if (relevant.length === 0) {
            this.readyThroughEpoch = commit.epoch
            this.currentStatus = Object.freeze({
                state: "ready",
                generation: this.publishedSnapshot.generation,
                progress: this.readyProgress,
                throughEpoch: commit.epoch,
            })
            this.statusLog.push(this.currentStatus)
            return
        }
        const candidate = cloneCandidate(this.readyCandidate)
        try {
            this.applyCommitBatch(candidate, relevant)
        } catch {
            this.failReady(
                "DELTA_CONTRACT_ERROR",
                "Prepared commit application failed",
            )
            return
        }
        if (candidateMatchesSnapshot(candidate, this.publishedSnapshot)) {
            this.readyCandidate = candidate
            this.readyThroughEpoch = commit.epoch
            this.currentStatus = Object.freeze({
                state: "ready",
                generation: this.publishedSnapshot.generation,
                progress: this.readyProgress,
                throughEpoch: commit.epoch,
            })
            this.statusLog.push(this.currentStatus)
            return
        }
        const snapshot = this.makeSnapshot(
            candidate,
            this.currentStatus.generation,
        )
        this.readyCandidate = candidate
        this.publishedSnapshot = snapshot
        this.readyThroughEpoch = commit.epoch
        this.currentStatus = Object.freeze({
            state: "ready",
            generation: snapshot.generation,
            progress: this.readyProgress,
            throughEpoch: commit.epoch,
        })
        this.statusLog.push(this.currentStatus)
        this.eventLog.push(
            Object.freeze({
                kind: "published",
                generation: snapshot.generation,
                throughEpoch: commit.epoch,
                source: "delta",
            }),
        )
    }

    cancel(reason = "cancelled"): void {
        this.assertOperationalCommandAllowed()
        if (this.build === undefined || this.disposed) return
        const build = this.build
        this.build = undefined
        this.publishedSnapshot = undefined
        this.readyCandidate = undefined
        this.currentStatus = Object.freeze({
            state: "cancelled",
            generation: build.generation,
            progress: Object.freeze({
                completed: build.completed,
                total: build.checkpoint.rows.length,
            }),
            throughEpoch: build.throughEpoch,
            reason,
        })
        this.statusLog.push(this.currentStatus)
        this.eventLog.push(
            Object.freeze({
                kind: "cancelled",
                generation: build.generation,
                reason,
            }),
        )
        build.wakeable.reject(reason)
    }

    dispose(): void {
        this.assertOperationalCommandAllowed()
        if (this.disposed) return
        if (this.build !== undefined) {
            const build = this.build
            this.build = undefined
            this.disposed = true
            this.publishedSnapshot = undefined
            this.readyCandidate = undefined
            this.currentStatus = Object.freeze({
                state: "cancelled",
                generation: build.generation,
                progress: Object.freeze({
                    completed: build.completed,
                    total: build.checkpoint.rows.length,
                }),
                throughEpoch: build.throughEpoch,
                reason: "disposed",
            })
            this.statusLog.push(this.currentStatus)
            this.eventLog.push(
                Object.freeze({
                    kind: "cancelled",
                    generation: build.generation,
                    reason: "disposed",
                }),
            )
            build.wakeable.reject("disposed")
            return
        } else {
            this.disposed = true
            const generation = this.currentStatus.generation
            const progress = this.currentStatus.progress
            const throughEpoch =
                "throughEpoch" in this.currentStatus
                    ? this.currentStatus.throughEpoch
                    : 0
            this.currentStatus = Object.freeze({
                state: "cancelled",
                generation,
                progress,
                throughEpoch,
                reason: "disposed",
            })
            this.statusLog.push(this.currentStatus)
            this.eventLog.push(
                Object.freeze({
                    kind: "cancelled",
                    generation,
                    reason: "disposed",
                }),
            )
        }
        this.publishedSnapshot = undefined
        this.readyCandidate = undefined
    }

    importArtifact(plan: ArtifactImportPlan): ArtifactImportResult {
        this.assertOperationalCommandAllowed()
        this.assertNotDisposed()
        this.assertCheckpointTarget(plan.baseCheckpoint)
        this.assertCheckpointTarget(plan.targetCheckpoint)
        assertCheckpointShape(plan.baseCheckpoint)
        assertCheckpointShape(plan.targetCheckpoint)
        if (this.build !== undefined) {
            throw new Error("Cannot import an artifact during a build")
        }
        const currentReady =
            this.currentStatus.state === "ready" &&
            this.publishedSnapshot !== undefined &&
            this.readyCandidate !== undefined
        const readySnapshot = this.publishedSnapshot
        const readyCandidate = this.readyCandidate
        let authoritativePlanEpoch = Math.max(
            plan.baseCheckpoint.epoch,
            plan.targetCheckpoint.epoch,
        )
        for (const commit of plan.laterCommits) {
            if (
                commit.tree === this.definition.tree &&
                Number.isSafeInteger(commit.epoch) &&
                commit.epoch >= 0
            ) {
                authoritativePlanEpoch = Math.max(
                    authoritativePlanEpoch,
                    commit.epoch,
                )
            }
        }
        const planAheadOfReady =
            currentReady && authoritativePlanEpoch > this.readyThroughEpoch
        this.observeEpoch(authoritativePlanEpoch)
        const reject = (code: ArtifactRejectionCode): ArtifactImportResult => {
            if (planAheadOfReady) {
                this.failReady(
                    code === "STALE_ARTIFACT"
                        ? "DELTA_SEQUENCE_ERROR"
                        : "DELTA_CONTRACT_ERROR",
                    `Authoritative artifact target rejected: ${code}`,
                )
            }
            return this.rejectArtifact(code)
        }
        if (plan.targetCheckpoint.epoch < this.consumedEpochFloor) {
            return reject("STALE_ARTIFACT")
        }

        const rejection = this.validateArtifact(plan.artifact)
        if (rejection !== undefined) {
            return reject(rejection)
        }
        const overlayRejection = this.validateScopeOverlay(
            plan.baseOverlay,
            plan.artifact,
            plan.baseCheckpoint,
        )
        if (overlayRejection !== undefined) {
            return reject(overlayRejection)
        }

        const candidate: Candidate = {
            order: plan.artifact.rows.map(entry => entry.row),
            keys: new Map(
                plan.artifact.rows.map(entry => [entry.row, entry.key]),
            ),
            values: new Map(
                plan.artifact.rows.map(entry => [entry.row, entry.value]),
            ),
        }
        let throughEpoch = plan.baseCheckpoint.epoch
        try {
            this.applyCommitBatch(candidate, plan.baseOverlay.deltas)
            if (
                candidate.order.length !==
                    plan.baseOverlay.targetOrder.length ||
                candidate.keys.size !== plan.baseOverlay.targetOrder.length ||
                candidate.values.size !== plan.baseOverlay.targetOrder.length ||
                plan.baseOverlay.targetOrder.some(
                    row =>
                        !candidate.keys.has(row) || !candidate.values.has(row),
                )
            ) {
                return reject("CORRUPT_ARTIFACT")
            }
            candidate.order.splice(
                0,
                candidate.order.length,
                ...plan.baseOverlay.targetOrder,
            )
            if (!candidateMatchesCheckpoint(candidate, plan.baseCheckpoint)) {
                return reject("STALE_ARTIFACT")
            }
            for (const commit of plan.laterCommits) {
                if (
                    commit.tree !== this.definition.tree ||
                    commit.definitionFingerprint !==
                        this.definition.fingerprint ||
                    commit.epoch !== throughEpoch + 1
                ) {
                    return reject("STALE_ARTIFACT")
                }
                const relevant = this.relevantDeltas(commit.deltas)
                this.validatePreparedBatch(relevant)
                this.applyCommitBatch(candidate, relevant)
                throughEpoch = commit.epoch
            }
        } catch {
            return reject("CORRUPT_ARTIFACT")
        }
        if (
            throughEpoch !== plan.targetCheckpoint.epoch ||
            !candidateMatchesCheckpoint(candidate, plan.targetCheckpoint)
        ) {
            return reject("STALE_ARTIFACT")
        }
        if (currentReady && throughEpoch === this.readyThroughEpoch) {
            if (!candidatesEqual(candidate, readyCandidate!)) {
                return reject("STALE_ARTIFACT")
            }
            return Object.freeze({
                ok: true,
                snapshot: readySnapshot!,
            })
        }
        if (
            currentReady &&
            readySnapshot !== undefined &&
            candidateMatchesSnapshot(candidate, readySnapshot)
        ) {
            this.readyCandidate = candidate
            this.readyThroughEpoch = plan.targetCheckpoint.epoch
            this.readyProgress = Object.freeze({
                completed: plan.targetCheckpoint.rows.length,
                total: plan.targetCheckpoint.rows.length,
            })
            this.currentStatus = Object.freeze({
                state: "ready",
                generation: readySnapshot.generation,
                progress: this.readyProgress,
                throughEpoch: plan.targetCheckpoint.epoch,
            })
            this.statusLog.push(this.currentStatus)
            return Object.freeze({ ok: true, snapshot: readySnapshot })
        }

        this.generation += 1
        const snapshot = this.makeSnapshot(candidate, this.generation)
        this.readyCandidate = candidate
        this.publishedSnapshot = snapshot
        this.readyThroughEpoch = plan.targetCheckpoint.epoch
        this.readyProgress = Object.freeze({
            completed: plan.targetCheckpoint.rows.length,
            total: plan.targetCheckpoint.rows.length,
        })
        this.currentStatus = Object.freeze({
            state: "ready",
            generation: this.generation,
            progress: this.readyProgress,
            throughEpoch: plan.targetCheckpoint.epoch,
        })
        this.statusLog.push(this.currentStatus)
        this.eventLog.push(
            Object.freeze({
                kind: "published",
                generation: this.generation,
                throughEpoch: plan.targetCheckpoint.epoch,
                source: "artifact",
            }),
        )
        return Object.freeze({ ok: true, snapshot })
    }

    exportArtifact(checkpoint: CollectionCheckpoint): IndexArtifact {
        this.assertOperationalCommandAllowed()
        this.assertNotDisposed()
        this.assertCheckpointTarget(checkpoint)
        assertCheckpointShape(checkpoint)
        if (
            this.publishedSnapshot === undefined ||
            this.readyCandidate === undefined ||
            checkpoint.epoch !== this.readyThroughEpoch
        ) {
            throw new Error(
                "Artifact export requires the exact ready checkpoint",
            )
        }
        const checkpointRows = checkpoint.rows.map(entry => entry.row)
        if (!sameStrings(checkpointRows, this.readyCandidate.order)) {
            throw new Error(
                "Artifact checkpoint membership does not match the index",
            )
        }
        const rows = checkpoint.rows.map(entry => {
            const key = this.readyCandidate?.keys.get(entry.row)
            const value = this.readyCandidate?.values.get(entry.row)
            if (
                key === undefined ||
                value === undefined ||
                !tokenObjectIs(entry.value, value)
            ) {
                throw new Error(
                    "Artifact checkpoint values do not match the index",
                )
            }
            return Object.freeze({
                row: entry.row,
                value: entry.value,
                key,
            })
        })
        const unsigned = {
            format: "valdres-index-operations-spike-v1" as const,
            collection: this.definition.collection,
            definitionFingerprint: this.definition.fingerprint,
            logicalCheckpoint: checkpoint.logicalCheckpoint,
            rows: Object.freeze(rows),
        }
        return Object.freeze({
            ...unsigned,
            checksum: checksumArtifact(unsigned),
        })
    }

    private start(checkpoint: CollectionCheckpoint): DemandResult {
        assertCheckpointShape(checkpoint)
        this.assertCheckpointNotBeforeFloor(checkpoint, "Build")
        this.observeEpoch(checkpoint.epoch)
        this.generation += 1
        const wakeable = new ControlledWakeable(this.generation)
        const build: ActiveBuild = {
            generation: this.generation,
            checkpoint: freezeCheckpoint(checkpoint),
            candidate: emptyCandidate(),
            journal: [],
            wakeable,
            completed: 0,
            throughEpoch: checkpoint.epoch,
        }
        this.build = build
        this.publishedSnapshot = undefined
        this.readyCandidate = undefined
        this.eventLog.push(
            Object.freeze({
                kind: "build-started",
                generation: build.generation,
                baselineEpoch: checkpoint.epoch,
                total: checkpoint.rows.length,
            }),
        )
        this.setBuildingStatus(build)
        if (checkpoint.rows.length === 0) this.schedulePublish(build)
        else this.scheduleScan(build)
        return Object.freeze({ state: "building", wakeable })
    }

    private scheduleScan(build: ActiveBuild): void {
        this.scheduler.schedule(
            `${this.definition.experimentalId}:scan:${build.completed}`,
            () => this.scanOne(build),
        )
    }

    private scanOne(build: ActiveBuild): void {
        if (this.build !== build) return
        const entry = build.checkpoint.rows[build.completed]
        if (entry === undefined) {
            this.schedulePublish(build)
            return
        }
        let key: string
        try {
            key = this.domain.runProjector(() =>
                runIndexProjector(
                    this.definition.project,
                    entry.row,
                    entry.value,
                ),
            )
        } catch {
            if (this.build === build && !this.disposed) {
                this.fail("BUILD_FAILED", "Index projector failed")
            }
            return
        }
        if (this.build !== build || this.disposed) return
        build.candidate.order.push(entry.row)
        build.candidate.keys.set(entry.row, key)
        build.candidate.values.set(entry.row, entry.value)
        build.completed += 1
        this.eventLog.push(
            Object.freeze({
                kind: "progress",
                generation: build.generation,
                completed: build.completed,
                total: build.checkpoint.rows.length,
            }),
        )
        this.setBuildingStatus(build)
        if (build.completed === build.checkpoint.rows.length) {
            this.schedulePublish(build)
        } else {
            this.scheduleScan(build)
        }
    }

    private schedulePublish(build: ActiveBuild): void {
        this.scheduler.schedule(
            `${this.definition.experimentalId}:publish`,
            () => this.publish(build),
        )
    }

    private publish(build: ActiveBuild): void {
        if (this.build !== build) return
        try {
            for (const commit of build.journal) {
                this.applyCommitBatch(build.candidate, commit.deltas)
            }
        } catch {
            this.fail(
                "DELTA_CONTRACT_ERROR",
                "Prepared journal application failed",
            )
            return
        }

        const snapshot = this.makeSnapshot(build.candidate, build.generation)
        this.build = undefined
        this.readyCandidate = build.candidate
        this.publishedSnapshot = snapshot
        this.readyThroughEpoch = build.throughEpoch
        this.readyProgress = Object.freeze({
            completed: build.completed,
            total: build.checkpoint.rows.length,
        })
        this.currentStatus = Object.freeze({
            state: "ready",
            generation: build.generation,
            progress: this.readyProgress,
            throughEpoch: build.throughEpoch,
        })
        this.statusLog.push(this.currentStatus)
        this.eventLog.push(
            Object.freeze({
                kind: "published",
                generation: build.generation,
                throughEpoch: build.throughEpoch,
                source: "build",
            }),
        )
        build.wakeable.fulfill(snapshot)
    }

    private applyCommitBatch(
        candidate: Candidate,
        deltas: readonly PreparedIndexDelta[],
    ): void {
        this.validatePreparedBatch(deltas)
        const nonInserts = deltas.filter(delta => delta.membership !== "insert")
        const inserts = deltas
            .filter(delta => delta.membership === "insert")
            .sort((left, right) => {
                const leftSequence = left.birthSequence!
                const rightSequence = right.birthSequence!
                return leftSequence === rightSequence
                    ? left.row < right.row
                        ? -1
                        : left.row > right.row
                          ? 1
                          : 0
                    : leftSequence - rightSequence
            })
        for (const delta of nonInserts) this.applyDelta(candidate, delta)
        for (const delta of inserts) this.applyDelta(candidate, delta)
    }

    private validatePreparedBatch(deltas: readonly PreparedIndexDelta[]): void {
        const rows = new Set<RowId>()
        const birthSequences = new Set<number>()
        for (const delta of deltas) {
            if (rows.has(delta.row)) {
                throw new DeltaContractError(
                    `Prepared commit repeats row ${delta.row}`,
                )
            }
            rows.add(delta.row)

            if (
                delta.before.kind !== "absent" &&
                delta.before.kind !== "present"
            ) {
                throw new DeltaContractError(
                    `Delta has an invalid before outcome for row ${delta.row}`,
                )
            }
            if (
                delta.after.kind !== "absent" &&
                delta.after.kind !== "present"
            ) {
                throw new DeltaContractError(
                    `Delta has an invalid after outcome for row ${delta.row}`,
                )
            }

            const expectedMembership =
                delta.before.kind === "absent" && delta.after.kind === "present"
                    ? "insert"
                    : delta.before.kind === "present" &&
                        delta.after.kind === "absent"
                      ? "remove"
                      : "unchanged"
            if (delta.membership !== expectedMembership) {
                throw new DeltaContractError(
                    `Delta membership disagrees for row ${delta.row}`,
                )
            }
            if (delta.membership === "insert") {
                if (
                    !Number.isSafeInteger(delta.birthSequence) ||
                    delta.birthSequence === undefined ||
                    delta.birthSequence <= 0
                ) {
                    throw new DeltaContractError(
                        `Insert delta requires a positive safe birth sequence for row ${delta.row}`,
                    )
                }
                if (birthSequences.has(delta.birthSequence)) {
                    throw new DeltaContractError(
                        `Prepared commit repeats birth sequence ${delta.birthSequence}`,
                    )
                }
                birthSequences.add(delta.birthSequence)
            } else if (hasOwn(delta, "birthSequence")) {
                throw new DeltaContractError(
                    `Non-insert delta carries a birth sequence for row ${delta.row}`,
                )
            }

            this.validatePreparedSide(
                delta.row,
                "before",
                delta.before.kind,
                delta.beforeKey,
                hasOwn(delta, "beforeKey"),
            )
            this.validatePreparedSide(
                delta.row,
                "after",
                delta.after.kind,
                delta.afterKey,
                hasOwn(delta, "afterKey"),
            )
        }
    }

    private validatePreparedSide(
        row: RowId,
        side: "before" | "after",
        outcome: "absent" | "present",
        key: unknown,
        carriesKey: boolean,
    ): void {
        if (outcome === "absent") {
            if (carriesKey) {
                throw new DeltaContractError(
                    `Absent ${side} outcome carries a key for row ${row}`,
                )
            }
            return
        }
        if (!carriesKey) {
            throw new DeltaContractError(
                `Present ${side} outcome has no prepared key for row ${row}`,
            )
        }
        try {
            assertPreparedIndexKey(key)
        } catch {
            throw new DeltaContractError("Prepared index key is invalid")
        }
    }

    private applyDelta(candidate: Candidate, delta: PreparedIndexDelta): void {
        const currentValue = candidate.values.get(delta.row)
        const currentKey = candidate.keys.get(delta.row)
        const present = currentValue !== undefined
        if (
            present !== (delta.before.kind === "present") ||
            (present &&
                delta.before.kind === "present" &&
                (!tokenObjectIs(currentValue, delta.before.value) ||
                    delta.beforeKey === undefined ||
                    currentKey !== delta.beforeKey))
        ) {
            throw new DeltaContractError(
                `Delta baseline disagrees for row ${delta.row}`,
            )
        }
        const expectedMembership =
            delta.before.kind === "absent" && delta.after.kind === "present"
                ? "insert"
                : delta.before.kind === "present" &&
                    delta.after.kind === "absent"
                  ? "remove"
                  : "unchanged"
        if (delta.membership !== expectedMembership) {
            throw new DeltaContractError(
                `Delta membership disagrees for row ${delta.row}`,
            )
        }

        if (delta.after.kind === "absent") {
            if (delta.afterKey !== undefined) {
                throw new DeltaContractError(
                    `Absent delta has a prepared key for row ${delta.row}`,
                )
            }
            candidate.values.delete(delta.row)
            candidate.keys.delete(delta.row)
            const index = candidate.order.indexOf(delta.row)
            if (index >= 0) candidate.order.splice(index, 1)
            return
        }
        if (delta.afterKey === undefined) {
            throw new DeltaContractError(
                `Present delta has no prepared key for row ${delta.row}`,
            )
        }
        if (!present) candidate.order.push(delta.row)
        candidate.values.set(delta.row, delta.after.value)
        candidate.keys.set(delta.row, delta.afterKey)
    }

    private relevantDeltas(
        deltas: readonly PreparedIndexDelta[],
    ): readonly PreparedIndexDelta[] {
        return Object.freeze(
            deltas.filter(
                delta =>
                    delta.scope === this.definition.scope &&
                    delta.collection === this.definition.collection,
            ),
        )
    }

    private makeSnapshot(
        candidate: Candidate,
        generation: number,
    ): IndexSnapshot {
        const buckets = new Map<string, RowId[]>()
        for (const row of candidate.order) {
            const key = candidate.keys.get(row)
            if (key === undefined) continue
            const bucket = buckets.get(key)
            if (bucket === undefined) buckets.set(key, [row])
            else bucket.push(row)
        }
        const orderedBuckets = [...buckets.entries()]
            .sort(([left], [right]) =>
                left < right ? -1 : left > right ? 1 : 0,
            )
            .map(([key, rows]) =>
                Object.freeze({ key, rows: Object.freeze([...rows]) }),
            )
        return Object.freeze({
            tree: this.definition.tree,
            scope: this.definition.scope,
            collection: this.definition.collection,
            generation,
            buckets: Object.freeze(orderedBuckets),
        })
    }

    private fail(code: BuildFailureCode, message: string): void {
        const build = this.build
        if (build === undefined) return
        this.build = undefined
        this.publishedSnapshot = undefined
        this.readyCandidate = undefined
        this.currentStatus = Object.freeze({
            state: "failed",
            generation: build.generation,
            progress: Object.freeze({
                completed: build.completed,
                total: build.checkpoint.rows.length,
            }),
            throughEpoch: build.throughEpoch,
            code,
            message,
        })
        this.statusLog.push(this.currentStatus)
        this.eventLog.push(
            Object.freeze({
                kind: "failed",
                generation: build.generation,
                code,
            }),
        )
        build.wakeable.reject(code)
    }

    private failReady(code: BuildFailureCode, message: string): void {
        if (this.currentStatus.state !== "ready") return
        const previous = this.currentStatus
        this.publishedSnapshot = undefined
        this.readyCandidate = undefined
        this.currentStatus = Object.freeze({
            state: "failed",
            generation: previous.generation,
            progress: previous.progress,
            throughEpoch: previous.throughEpoch,
            code,
            message,
        })
        this.statusLog.push(this.currentStatus)
        this.eventLog.push(
            Object.freeze({
                kind: "failed",
                generation: previous.generation,
                code,
            }),
        )
    }

    private setBuildingStatus(build: ActiveBuild): void {
        this.currentStatus = Object.freeze({
            state: "building",
            generation: build.generation,
            progress: Object.freeze({
                completed: build.completed,
                total: build.checkpoint.rows.length,
            }),
            throughEpoch: build.throughEpoch,
        })
        this.statusLog.push(this.currentStatus)
    }

    private validateArtifact(
        artifact: IndexArtifact,
    ): ArtifactRejectionCode | undefined {
        if (
            artifact.format !== "valdres-index-operations-spike-v1" ||
            artifact.collection !== this.definition.collection
        ) {
            return "ARTIFACT_TARGET_MISMATCH"
        }
        if (artifact.definitionFingerprint !== this.definition.fingerprint) {
            return "ARTIFACT_DEFINITION_MISMATCH"
        }
        try {
            const unsigned = {
                format: artifact.format,
                collection: artifact.collection,
                definitionFingerprint: artifact.definitionFingerprint,
                logicalCheckpoint: artifact.logicalCheckpoint,
                rows: artifact.rows,
            }
            if (checksumArtifact(unsigned) !== artifact.checksum) {
                return "CORRUPT_ARTIFACT"
            }
            const artifactRows = artifact.rows.map(entry => entry.row)
            if (new Set(artifactRows).size !== artifactRows.length) {
                return "CORRUPT_ARTIFACT"
            }
            for (const entry of artifact.rows) {
                assertPreparedIndexKey(entry.key)
            }
            if (
                artifact.logicalCheckpoint !==
                logicalCheckpointFor(artifact.collection, artifact.rows)
            ) {
                return "CORRUPT_ARTIFACT"
            }
        } catch {
            return "CORRUPT_ARTIFACT"
        }
        return undefined
    }

    private validateScopeOverlay(
        overlay: PreparedScopeOverlay,
        artifact: IndexArtifact,
        baseCheckpoint: CollectionCheckpoint,
    ): ArtifactRejectionCode | undefined {
        if (overlay.collection !== this.definition.collection) {
            return "ARTIFACT_TARGET_MISMATCH"
        }
        if (overlay.definitionFingerprint !== this.definition.fingerprint) {
            return "ARTIFACT_DEFINITION_MISMATCH"
        }
        if (
            overlay.sourceLogicalCheckpoint !== artifact.logicalCheckpoint ||
            overlay.targetLogicalCheckpoint !== baseCheckpoint.logicalCheckpoint
        ) {
            return "STALE_ARTIFACT"
        }
        try {
            const targetOrder = overlay.targetOrder
            if (
                new Set(targetOrder).size !== targetOrder.length ||
                !sameStrings(
                    targetOrder,
                    baseCheckpoint.rows.map(entry => entry.row),
                )
            ) {
                return "CORRUPT_ARTIFACT"
            }
            for (const delta of overlay.deltas) {
                if (
                    delta.scope !== this.definition.scope ||
                    delta.collection !== this.definition.collection
                ) {
                    return "ARTIFACT_TARGET_MISMATCH"
                }
            }
            this.validatePreparedBatch(overlay.deltas)

            const sourceRows = new Set(artifact.rows.map(entry => entry.row))
            const targetRows = new Set(targetOrder)
            const expectedRows = new Set([...sourceRows, ...targetRows])
            const deltaRows = new Set(overlay.deltas.map(delta => delta.row))
            if (
                deltaRows.size !== expectedRows.size ||
                [...expectedRows].some(row => !deltaRows.has(row))
            ) {
                return "CORRUPT_ARTIFACT"
            }
            for (const delta of overlay.deltas) {
                if (
                    (delta.before.kind === "present") !==
                        sourceRows.has(delta.row) ||
                    (delta.after.kind === "present") !==
                        targetRows.has(delta.row)
                ) {
                    return "CORRUPT_ARTIFACT"
                }
            }
        } catch {
            return "CORRUPT_ARTIFACT"
        }
        return undefined
    }

    private rejectArtifact(
        code: ArtifactRejectionCode,
    ): Extract<ArtifactImportResult, { ok: false }> {
        this.eventLog.push(Object.freeze({ kind: "artifact-rejected", code }))
        return Object.freeze({ ok: false, error: code })
    }

    private assertCheckpointTarget(checkpoint: CollectionCheckpoint): void {
        if (
            checkpoint.tree !== this.definition.tree ||
            checkpoint.scope !== this.definition.scope ||
            checkpoint.collection !== this.definition.collection
        ) {
            throw new Error("Checkpoint target does not match index target")
        }
    }

    private assertNotDisposed(): void {
        if (this.disposed) throw new Error("Index operations are disposed")
    }

    private assertOperationalCommandAllowed(): void {
        this.domain.assertOperationalCommandAllowed()
    }

    private assertCheckpointNotBeforeFloor(
        checkpoint: CollectionCheckpoint,
        operation: string,
    ): void {
        if (checkpoint.epoch < this.consumedEpochFloor) {
            throw new Error(
                `${operation} checkpoint epoch ${checkpoint.epoch} is older than consumed epoch ${this.consumedEpochFloor}`,
            )
        }
    }

    private observeEpoch(epoch: number): void {
        this.consumedEpochFloor = Math.max(this.consumedEpochFloor, epoch)
    }

    private failActiveOrReady(code: BuildFailureCode, message: string): void {
        if (this.build !== undefined) this.fail(code, message)
        else this.failReady(code, message)
    }
}

class DeltaContractError extends Error {}

function hasOwn(value: object, key: PropertyKey): boolean {
    return Object.prototype.hasOwnProperty.call(value, key)
}

function emptyCandidate(): Candidate {
    return { order: [], keys: new Map(), values: new Map() }
}

function cloneCandidate(candidate: Candidate): Candidate {
    return {
        order: [...candidate.order],
        keys: new Map(candidate.keys),
        values: new Map(candidate.values),
    }
}

function freezeCheckpoint(
    checkpoint: CollectionCheckpoint,
): CollectionCheckpoint {
    return Object.freeze({
        ...checkpoint,
        rows: Object.freeze(
            checkpoint.rows.map(entry =>
                Object.freeze({ row: entry.row, value: entry.value }),
            ),
        ),
    })
}

function assertCheckpointShape(checkpoint: CollectionCheckpoint): void {
    if (!Number.isSafeInteger(checkpoint.epoch) || checkpoint.epoch < 0) {
        throw new Error("Checkpoint epoch must be a non-negative integer")
    }
    const rows = checkpoint.rows.map(entry => entry.row)
    if (new Set(rows).size !== rows.length) {
        throw new Error("Checkpoint rows must be unique")
    }
    if (
        checkpoint.logicalCheckpoint !==
        logicalCheckpointFor(checkpoint.collection, checkpoint.rows)
    ) {
        throw new Error("Checkpoint logical fingerprint is invalid")
    }
}

function sameStrings(
    left: readonly string[],
    right: readonly string[],
): boolean {
    return (
        left.length === right.length &&
        left.every((value, index) => value === right[index])
    )
}

function candidateMatchesCheckpoint(
    candidate: Candidate,
    checkpoint: CollectionCheckpoint,
): boolean {
    if (
        !sameStrings(
            candidate.order,
            checkpoint.rows.map(entry => entry.row),
        )
    ) {
        return false
    }
    return checkpoint.rows.every(entry => {
        const value = candidate.values.get(entry.row)
        return value !== undefined && tokenObjectIs(value, entry.value)
    })
}

function candidatesEqual(left: Candidate, right: Candidate): boolean {
    if (!sameStrings(left.order, right.order)) return false
    return left.order.every(row => {
        const leftValue = left.values.get(row)
        const rightValue = right.values.get(row)
        return (
            leftValue !== undefined &&
            rightValue !== undefined &&
            tokenObjectIs(leftValue, rightValue) &&
            left.keys.get(row) === right.keys.get(row)
        )
    })
}

function candidateMatchesSnapshot(
    candidate: Candidate,
    snapshot: IndexSnapshot,
): boolean {
    const buckets = new Map<string, RowId[]>()
    for (const row of candidate.order) {
        const key = candidate.keys.get(row)
        if (key === undefined) return false
        const rows = buckets.get(key)
        if (rows === undefined) buckets.set(key, [row])
        else rows.push(row)
    }
    if (buckets.size !== snapshot.buckets.length) return false
    return snapshot.buckets.every(bucket => {
        const rows = buckets.get(bucket.key)
        return rows !== undefined && sameStrings(rows, bucket.rows)
    })
}

type UnsignedArtifact = Omit<IndexArtifact, "checksum">

function checksumArtifact(artifact: UnsignedArtifact): string {
    return checksum(
        JSON.stringify([
            artifact.format,
            artifact.collection,
            artifact.definitionFingerprint,
            artifact.logicalCheckpoint,
            artifact.rows.map(entry => [
                entry.row,
                encodeValueToken(entry.value),
                entry.key,
            ]),
        ]),
    )
}
