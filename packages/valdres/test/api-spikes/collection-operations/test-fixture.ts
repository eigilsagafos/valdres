import type {
    AuditEvent,
    Command,
    EffectiveRowDelta,
    ReadOutcome,
    ReferenceModel,
    ScopeId,
    ValueToken,
} from "../../v1-model/index"
import { createReferenceModel, value } from "../../v1-model/index"
import { logicalCheckpointFor, prepareIndexDelta } from "./preparation"
import type {
    CollectionCheckpoint,
    IndexArtifact,
    IndexDefinition,
    IndexProjector,
    PreparedCollectionCommit,
    PreparedScopeOverlay,
} from "./types"

export interface RawCollectionCommit {
    readonly tree: string
    readonly epoch: number
    readonly deltas: readonly EffectiveRowDelta[]
}

export class CollectionFixture {
    readonly model: ReferenceModel = createReferenceModel()
    private readSequence = 0

    constructor(rows: readonly string[] = ["a", "b", "c"]) {
        this.ok({
            kind: "define-collection",
            collection: { id: "movies" },
        })
        for (const row of rows) {
            this.ok({
                kind: "define-row",
                collection: "movies",
                row,
                key: row,
            })
        }
        this.ok({ kind: "create-tree", tree: "tree", root: "root" })
    }

    createChild(scope = "child"): void {
        this.ok({
            kind: "create-scope",
            tree: "tree",
            parent: "root",
            scope,
        })
    }

    set(scope: ScopeId, row: string, label: string): RawCollectionCommit {
        return this.mutate({
            kind: "mutate",
            tree: "tree",
            scope,
            mutation: {
                kind: "set-row",
                row,
                value: value.string(label),
            },
        })
    }

    remove(scope: ScopeId, row: string): RawCollectionCommit {
        return this.mutate({
            kind: "mutate",
            tree: "tree",
            scope,
            mutation: { kind: "delete-row", row },
        })
    }

    reset(scope: ScopeId, row: string): RawCollectionCommit {
        return this.mutate({
            kind: "mutate",
            tree: "tree",
            scope,
            mutation: { kind: "reset-row", row },
        })
    }

    transactSet(
        scope: ScopeId,
        writes: readonly Readonly<{ row: string; label: string }>[],
    ): RawCollectionCommit {
        return this.mutate({
            kind: "transact",
            tree: "tree",
            entryScope: scope,
            steps: writes.map(write => ({
                kind: "mutate" as const,
                cursor: "entry",
                mutation: {
                    kind: "set-row" as const,
                    row: write.row,
                    value: value.string(write.label),
                },
            })),
        })
    }

    checkpoint(scope: ScopeId): CollectionCheckpoint {
        const collection = this.read(scope, {
            kind: "collection",
            collection: "movies",
        })
        if (collection.kind !== "rows") {
            throw new Error("Expected a collection membership outcome")
        }
        const rows = collection.rows.map(row => {
            const outcome = this.read(scope, { kind: "row", row })
            if (outcome.kind !== "value") {
                throw new Error(`Membership row ${row} is not present`)
            }
            return Object.freeze({ row, value: outcome.value })
        })
        return Object.freeze({
            tree: "tree",
            scope,
            collection: "movies",
            epoch: this.epoch(),
            logicalCheckpoint: logicalCheckpointFor("movies", rows),
            rows: Object.freeze(rows),
        })
    }

    definition(
        scope: ScopeId,
        project: IndexProjector = stringProjector,
    ): IndexDefinition {
        return Object.freeze({
            experimentalId: `movies-by-value:${scope}`,
            fingerprint: "movies-by-value/v1",
            tree: "tree",
            scope,
            collection: "movies",
            project,
        })
    }

    prepare(
        commit: RawCollectionCommit,
        definition: IndexDefinition,
        project?: IndexProjector,
    ): PreparedCollectionCommit {
        return Object.freeze({
            tree: commit.tree,
            epoch: commit.epoch,
            definitionFingerprint: definition.fingerprint,
            deltas: Object.freeze(
                commit.deltas.map(delta =>
                    prepareIndexDelta(delta, project ?? definition.project),
                ),
            ),
        })
    }

    prepareScopeOverlay(
        artifact: Pick<IndexArtifact, "logicalCheckpoint" | "rows">,
        checkpoint: CollectionCheckpoint,
        definition: IndexDefinition,
        project: IndexProjector = definition.project,
    ): PreparedScopeOverlay {
        if (
            checkpoint.tree !== definition.tree ||
            checkpoint.scope !== definition.scope ||
            checkpoint.collection !== definition.collection
        ) {
            throw new Error(
                "Overlay checkpoint target does not match definition",
            )
        }
        const artifactRows = new Map(
            artifact.rows.map(entry => [entry.row, entry] as const),
        )
        const targetRows = new Map(
            checkpoint.rows.map(entry => [entry.row, entry] as const),
        )
        const rows = [
            ...artifact.rows.map(entry => entry.row),
            ...checkpoint.rows
                .map(entry => entry.row)
                .filter(row => !artifactRows.has(row)),
        ]
        return Object.freeze({
            collection: checkpoint.collection,
            definitionFingerprint: definition.fingerprint,
            sourceLogicalCheckpoint: artifact.logicalCheckpoint,
            targetLogicalCheckpoint: checkpoint.logicalCheckpoint,
            targetOrder: Object.freeze(checkpoint.rows.map(entry => entry.row)),
            deltas: Object.freeze(
                rows.map(row => {
                    const source = artifactRows.get(row)
                    const target = targetRows.get(row)
                    const delta: EffectiveRowDelta = Object.freeze({
                        scope: checkpoint.scope,
                        collection: checkpoint.collection,
                        row,
                        before:
                            source === undefined
                                ? Object.freeze({ kind: "absent" as const })
                                : Object.freeze({
                                      kind: "present" as const,
                                      value: source.value,
                                  }),
                        after:
                            target === undefined
                                ? Object.freeze({ kind: "absent" as const })
                                : Object.freeze({
                                      kind: "present" as const,
                                      value: target.value,
                                  }),
                        membership:
                            source === undefined
                                ? "insert"
                                : target === undefined
                                  ? "remove"
                                  : "unchanged",
                        ...(source === undefined && target !== undefined
                            ? {
                                  birthSequence:
                                      checkpoint.rows.findIndex(
                                          entry => entry.row === row,
                                      ) + 1,
                              }
                            : {}),
                    })
                    return prepareIndexDelta(delta, project)
                }),
            ),
        })
    }

    private mutate(command: Command): RawCollectionCommit {
        const before = this.commits().length
        this.ok(command)
        const commits = this.commits()
        if (commits.length !== before + 1) {
            throw new Error("Expected exactly one collection-model commit")
        }
        const commit = commits.at(-1)!
        return Object.freeze({
            tree: commit.tree,
            epoch: commit.epoch,
            deltas: commit.collectionDeltas,
        })
    }

    private read(
        scope: ScopeId,
        target: Extract<Command, { kind: "read" }>["target"],
    ): ReadOutcome {
        const result = this.model.execute({
            kind: "read",
            tree: "tree",
            scope,
            target,
            as: `index-spike-read-${this.readSequence++}`,
        })
        if (!result.ok || result.outcome === undefined) {
            throw new Error(result.error ?? "Reference-model read failed")
        }
        return result.outcome
    }

    private ok(command: Command): void {
        const result = this.model.execute(command)
        if (!result.ok) throw new Error(result.error ?? "Command failed")
    }

    private commits(): readonly Extract<AuditEvent, { kind: "commit" }>[] {
        return this.model.audit.filter(
            (event): event is Extract<AuditEvent, { kind: "commit" }> =>
                event.kind === "commit",
        )
    }

    private epoch(): number {
        return this.commits().at(-1)?.epoch ?? 0
    }
}

export function stringProjector(_row: string, token: ValueToken): string {
    if (token.kind !== "string") {
        throw new Error(`Expected a string token, received ${token.kind}`)
    }
    return token.value
}

export function deltasFor(
    commit: Readonly<{ deltas: readonly EffectiveRowDelta[] }>,
    scope: ScopeId,
): readonly EffectiveRowDelta[] {
    return commit.deltas.filter(delta => delta.scope === scope)
}
