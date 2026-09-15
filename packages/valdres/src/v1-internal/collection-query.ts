import type { TreeDraft } from "./committed-store-tree/tree-transaction"
import {
    COLLECTION_INDEX_MATERIALIZATIONS,
    COLLECTION_INDEX_BUCKETS_CREATED,
    COLLECTION_INDEX_GROUPS_CREATED,
    COLLECTION_INDEX_INITIAL_ROWS,
    COLLECTION_INDEX_EXTRACTOR_CALLS,
    COLLECTION_INDEX_DELTA_ROWS,
    COLLECTION_INDEX_BUCKET_ROWS,
    COLLECTION_INDEX_BUCKET_PUBLICATIONS,
} from "./collection-inspection-protocol"
import type { ServedSelectorOutcome } from "./selector-evaluator/types"
import type {
    CollectionIndexHost,
    CollectionIndexRuntime,
    IndexScopeDelta,
} from "./collection-index-protocol"
import type {
    AnyState,
    CollectionCommitSource,
} from "./committed-store-tree/runtime-domain"
import {
    WeakHandleSet,
    type StoreScopeNode,
} from "./committed-store-tree/scope-node"
import type { CollectionKey } from "./committed-store-tree/types"

export interface QueryDefinition {
    readonly collection: object
    readonly index: string
    readonly value: CollectionKey
    readonly extract: (value: unknown) => CollectionKey
}
interface QueryRecord {
    readonly atom: object
    readonly scope: StoreScopeNode
    served: ServedSelectorOutcome<object>
}
interface Bucket {
    rows: readonly object[]
    readonly readers: WeakHandleSet<QueryRecord>
}
interface IndexRecord {
    readonly definition: QueryDefinition
    readonly keys: WeakMap<object, CollectionKey>
    // Membership exists for each present scalar; reader/snapshot state is lazy.
    readonly groups: Map<CollectionKey, Set<object>>
    readonly views: Map<CollectionKey, WeakRef<Bucket>>
}
const EMPTY = Object.freeze([]) as readonly object[]
const serve = (
    scope: StoreScopeNode,
    rows: readonly object[],
): ServedSelectorOutcome<object> =>
    Object.freeze({
        token: scope.createOutcomeToken(),
        outcome: Object.freeze({ kind: "value", value: rows }),
    })
const sameRows = (a: readonly object[], b: readonly object[]): boolean =>
    a.length === b.length && a.every((row, index) => row === b[index])

export const createCollectionQueryRuntime = (
    host: CollectionIndexHost,
    definitions: WeakMap<object, QueryDefinition>,
): CollectionIndexRuntime => {
    const scratch = new WeakMap<
        TreeDraft,
        WeakMap<
            StoreScopeNode,
            WeakMap<object, { revision: number; rows: readonly object[] }>
        >
    >()
    const active = new WeakMap<object, WeakHandleSet<IndexRecord>>()
    const scopes = new WeakMap<
        StoreScopeNode,
        Map<object, Map<string, IndexRecord>>
    >()
    const readers = new WeakMap<
        StoreScopeNode,
        WeakMap<object, { record: QueryRecord; bucket: Bucket }>
    >()
    // Held maps contain only weak views, never scope/index ownership.
    const viewFinalizer = new FinalizationRegistry<{
        map: IndexRecord["views"]
        key: CollectionKey
        ref: WeakRef<Bucket>
    }>(held => {
        if (held.map.get(held.key) === held.ref) held.map.delete(held.key)
    })
    const bucketFor = (
        scope: StoreScopeNode,
        index: IndexRecord,
        key: CollectionKey,
    ): Bucket => {
        const known = index.views.get(key)?.deref()
        if (known !== undefined && !known.readers.isEmpty()) return known
        if (known !== undefined) viewFinalizer.unregister(known)
        const membership = host.membership(scope, index.definition.collection)
        const rows = [...(index.groups.get(key) ?? [])].sort(
            (a, b) =>
                membership.entries.get(a)!.rank -
                membership.entries.get(b)!.rank,
        )
        if (rows.length)
            scope.coordinator.evaluate.recordExtension?.(
                COLLECTION_INDEX_BUCKET_ROWS,
                rows.length,
            )
        scope.coordinator.evaluate.recordExtension?.(
            COLLECTION_INDEX_BUCKETS_CREATED,
            1,
        )
        const bucket: Bucket = {
            rows: rows.length ? Object.freeze(rows) : EMPTY,
            readers: new WeakHandleSet(() => {}),
        }
        const ref = new WeakRef(bucket)
        index.views.set(key, ref)
        viewFinalizer.register(bucket, { map: index.views, key, ref }, bucket)
        return bucket
    }
    const materialize = (
        scope: StoreScopeNode,
        definition: QueryDefinition,
    ): IndexRecord => {
        let collections = scopes.get(scope)
        const current = collections
            ?.get(definition.collection)
            ?.get(definition.index)
        if (current !== undefined) return current
        const membership = host.membership(scope, definition.collection)
        scope.coordinator.evaluate.recordExtension?.(
            COLLECTION_INDEX_MATERIALIZATIONS,
            COLLECTION_INDEX_BUCKETS_CREATED,
            COLLECTION_INDEX_GROUPS_CREATED,
            1,
        )
        if (membership.entries.size)
            scope.coordinator.evaluate.recordExtension?.(
                COLLECTION_INDEX_INITIAL_ROWS,
                membership.entries.size,
            )
        const keys = new WeakMap<object, CollectionKey>()
        const groups = new Map<CollectionKey, Set<object>>()
        // Publish no index state until every extractor has passed validation.
        for (const row of membership.entries.keys()) {
            const value = host.value(scope, row)
            scope.coordinator.evaluate.recordExtension?.(
                COLLECTION_INDEX_EXTRACTOR_CALLS,
                1,
            )
            const key = definition.extract(value)
            keys.set(row, key)
            let rows = groups.get(key)
            if (rows === undefined) groups.set(key, (rows = new Set()))
            rows.add(row)
        }
        const index: IndexRecord = {
            definition,
            keys,
            groups,
            views: new Map(),
        }
        if (groups.size)
            scope.coordinator.evaluate.recordExtension?.(
                COLLECTION_INDEX_GROUPS_CREATED,
                groups.size,
            )
        if (collections === undefined)
            scopes.set(scope, (collections = new Map()))
        let indexes = collections.get(definition.collection)
        if (indexes === undefined)
            collections.set(definition.collection, (indexes = new Map()))
        indexes.set(definition.index, index)
        let live = active.get(definition.collection)
        if (live === undefined)
            active.set(definition.collection, (live = new WeakHandleSet()))
        live.add(index)
        return index
    }
    return {
        active: collection => active.get(collection)?.isEmpty() === false,
        has: node => definitions.has(node),
        scope(scope, node) {
            let byQuery = readers.get(scope)
            const known = byQuery?.get(node)
            if (known !== undefined) return known.record.served
            const definition = definitions.get(node)!
            const index = materialize(scope, definition)
            const bucket = bucketFor(scope, index, definition.value)
            const record: QueryRecord = {
                atom: node,
                scope,
                served: serve(scope, bucket.rows),
            }
            bucket.readers.add(record)
            if (byQuery === undefined)
                readers.set(scope, (byQuery = new WeakMap()))
            byQuery.set(node, { record, bucket })
            return record.served
        },
        read(draft, scope, node) {
            const definition = definitions.get(node)!
            const revision = host.revision(draft, definition.collection)
            let byScope = scratch.get(draft)
            let byQuery = byScope?.get(scope)
            const known = byQuery?.get(node)
            if (known?.revision === revision) return known.rows
            // Scratch observations are isolated from committed buckets and never
            // survive rollback. The committed steady path never scans membership.
            const result: object[] = []
            for (const row of host.draftRows(
                draft,
                scope,
                definition.collection,
            )) {
                const value = host.draftValue(draft, scope, row)
                if (value === undefined) continue
                scope.coordinator.evaluate.recordExtension?.(
                    COLLECTION_INDEX_EXTRACTOR_CALLS,
                    1,
                )
                if (definition.extract(value) === definition.value)
                    result.push(row)
            }
            const previous =
                known?.rows ?? readers.get(scope)?.get(node)?.bucket.rows
            const rows =
                previous !== undefined && sameRows(previous, result)
                    ? previous
                    : Object.freeze(result)
            if (byScope === undefined)
                scratch.set(draft, (byScope = new WeakMap()))
            if (byQuery === undefined)
                byScope.set(scope, (byQuery = new WeakMap()))
            byQuery.set(node, { revision, rows })
            return rows
        },
        release(draft) {
            scratch.delete(draft)
        },
        prepare(deltas: readonly IndexScopeDelta[]) {
            const updates: (() => void)[] = []
            const sources: CollectionCommitSource[] = []
            for (const delta of deltas) {
                const indexes = scopes.get(delta.scope)?.get(delta.collection)
                if (indexes === undefined) continue
                const membership = host.membership(
                    delta.scope,
                    delta.collection,
                )
                for (const index of indexes.values()) {
                    const affected = new Map<
                        CollectionKey,
                        { remove: object[]; add: object[] }
                    >()
                    const ranks = new Map<object, number>()
                    const keys: {
                        row: object
                        key: CollectionKey | undefined
                    }[] = []
                    const touch = (key: CollectionKey) => {
                        let entry = affected.get(key)
                        if (entry === undefined)
                            affected.set(key, (entry = { remove: [], add: [] }))
                        return entry
                    }
                    for (const change of delta.changes) {
                        delta.scope.coordinator.evaluate.recordExtension?.(
                            COLLECTION_INDEX_DELTA_ROWS,
                            1,
                        )
                        if (
                            change.after !== undefined &&
                            !Object.is(change.before, change.after)
                        )
                            delta.scope.coordinator.evaluate.recordExtension?.(
                                COLLECTION_INDEX_EXTRACTOR_CALLS,
                                1,
                            )
                        const oldKey = index.keys.get(change.row)
                        const key =
                            change.after === undefined
                                ? undefined
                                : Object.is(change.before, change.after)
                                  ? oldKey
                                  : index.definition.extract(change.after)
                        keys.push({ row: change.row, key })
                        if (
                            key === oldKey &&
                            change.rank ===
                                membership.entries.get(change.row)?.rank
                        )
                            continue
                        if (oldKey !== undefined)
                            touch(oldKey).remove.push(change.row)
                        if (key !== undefined) {
                            touch(key).add.push(change.row)
                            ranks.set(change.row, change.rank!)
                        }
                    }
                    const prepared: {
                        bucket: Bucket
                        next: readonly object[]
                    }[] = []
                    for (const [key, change] of affected) {
                        const bucket = index.views.get(key)?.deref()
                        // No reader: stage only O(changed rows) membership edits.
                        // Do not copy, sort, freeze, or allocate a query bucket.
                        if (bucket === undefined || bucket.readers.isEmpty())
                            continue
                        const rows = new Set(index.groups.get(key))
                        for (const row of change.remove) rows.delete(row)
                        for (const row of change.add) rows.add(row)
                        if (rows.size)
                            delta.scope.coordinator.evaluate.recordExtension?.(
                                COLLECTION_INDEX_BUCKET_ROWS,
                                rows.size,
                            )
                        const next = [...rows].sort(
                            (a, b) =>
                                (ranks.get(a) ??
                                    membership.entries.get(a)!.rank) -
                                (ranks.get(b) ??
                                    membership.entries.get(b)!.rank),
                        )
                        prepared.push({
                            bucket,
                            next: sameRows(bucket.rows, next)
                                ? bucket.rows
                                : Object.freeze(next),
                        })
                    }
                    updates.push(() => {
                        for (const { row, key } of keys) {
                            if (key === undefined) index.keys.delete(row)
                            else index.keys.set(row, key)
                        }
                        for (const [key, change] of affected) {
                            let rows = index.groups.get(key)
                            if (rows === undefined) {
                                rows = new Set()
                                index.groups.set(key, rows)
                                delta.scope.coordinator.evaluate.recordExtension?.(
                                    COLLECTION_INDEX_GROUPS_CREATED,
                                    1,
                                )
                            }
                            for (const row of change.remove) rows.delete(row)
                            for (const row of change.add) rows.add(row)
                            if (rows.size === 0) index.groups.delete(key)
                        }
                        for (const { bucket, next } of prepared) {
                            if (next === bucket.rows) continue
                            delta.scope.coordinator.evaluate.recordExtension?.(
                                COLLECTION_INDEX_BUCKET_PUBLICATIONS,
                                1,
                            )
                            bucket.rows = next
                            bucket.readers.forEach(record => {
                                record.served = serve(delta.scope, next)
                                sources.push({
                                    scope: delta.scope,
                                    atom: record.atom as AnyState,
                                })
                                delta.scope.coordinator.reachSubscriptionTarget(
                                    delta.scope,
                                    record.atom as AnyState,
                                )
                            })
                        }
                    })
                }
            }
            return {
                publish() {
                    for (const update of updates) update()
                    return sources
                },
            }
        },
        dispose(scope) {
            const collections = scopes.get(scope)
            if (collections !== undefined)
                for (const indexes of collections.values())
                    for (const index of indexes.values()) {
                        active.get(index.definition.collection)?.delete(index)
                        index.groups.clear()
                        for (const ref of index.views.values()) {
                            const bucket = ref.deref()
                            if (bucket !== undefined)
                                viewFinalizer.unregister(bucket)
                        }
                        index.views.clear()
                    }
            scopes.delete(scope)
            readers.delete(scope)
        },
    }
}
