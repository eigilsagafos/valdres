import type { ServedSelectorOutcome } from "./selector-evaluator/types"
import type { CollectionCommitSource } from "./committed-store-tree/runtime-domain"
import type { StoreScopeNode } from "./committed-store-tree/scope-node"
import type { TreeDraft } from "./committed-store-tree/tree-transaction"
import type { OrderedMembership } from "./ordered-membership"

export interface IndexDelta {
    readonly row: object
    readonly before: unknown
    readonly after: unknown
    /** Undefined means absent; numeric values preserve final membership order. */
    readonly rank: number | undefined
}
export interface IndexScopeDelta {
    readonly scope: StoreScopeNode
    readonly collection: object
    readonly changes: readonly IndexDelta[]
}
export interface CollectionIndexHost {
    revision(draft: TreeDraft, collection: object): number
    membership(scope: StoreScopeNode, collection: object): OrderedMembership
    value(scope: StoreScopeNode, row: object): unknown
    draftRows(
        draft: TreeDraft,
        scope: StoreScopeNode,
        collection: object,
    ): readonly object[]
    draftValue(draft: TreeDraft, scope: StoreScopeNode, row: object): unknown
}
export interface CollectionIndexRuntime {
    active(collection: object): boolean
    has(node: object): boolean
    read(draft: TreeDraft, scope: StoreScopeNode, node: object): unknown
    scope(scope: StoreScopeNode, node: object): ServedSelectorOutcome<object>
    prepare(changes: readonly IndexScopeDelta[]): {
        publish(): readonly CollectionCommitSource[]
    }
    dispose(scope: StoreScopeNode): void
    release(draft: TreeDraft): void
}
