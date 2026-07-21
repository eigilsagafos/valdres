import type { MutationDraft } from "../types/MutationDraft"

/**
 * Lifecycle helpers for a transaction's write overlay. Deliberately free of
 * runtime imports: the draft is pure staging data, so this module stays a leaf
 * outside the core write-path import cycle (see test/import-cycles). All
 * tree-aware staging logic (parent chains, scoped recursion, family-index
 * cloning) lives with the transaction context that owns the draft.
 */

/** A fresh overlay. `values` is eager (every transaction stages something);
 *  the remaining collections allocate lazily on first use, preserving the
 *  allocation profile of the historical per-field staging state. */
export const createMutationDraft = (): MutationDraft => ({
    values: new Map(),
    unsets: undefined,
    deletes: undefined,
    dirtyFamilyIndexes: undefined,
    initializedAtoms: undefined,
    dirty: false,
    selectorCache: undefined,
    selectorRuntime: undefined,
    selectorCircularDependencies: undefined,
    hasCommitEffects: false,
})

/**
 * Discard every staged mutation and tear down speculative evaluation state:
 * revoke live evaluation contexts and abort in-flight selector work so an
 * abandoned overlay can never publish a result into the committed store.
 * Called on abort/disposal only — a committed transaction keeps its (already
 * applied) staging state exactly as the historical fields did.
 */
export const resetMutationDraft = (draft: MutationDraft): void => {
    const runtime = draft.selectorRuntime
    if (runtime) {
        runtime.readOverlayActive = false
        for (const context of runtime.latestEvalContext.values()) {
            context.revoke()
        }
        for (const controller of runtime.abortControllers.values()) {
            controller.abort()
        }
        runtime.latestEvalContext.clear()
        runtime.abortControllers.clear()
        runtime.stateDependencies.clear()
        draft.selectorRuntime = undefined
    }
    draft.values.clear()
    draft.initializedAtoms?.clear()
    draft.initializedAtoms = undefined
    draft.deletes?.clear()
    draft.deletes = undefined
    draft.unsets?.clear()
    draft.unsets = undefined
    draft.selectorCache?.clear()
    draft.selectorCache = undefined
    draft.selectorCircularDependencies = undefined
    draft.dirtyFamilyIndexes?.clear()
    draft.dirtyFamilyIndexes = undefined
    draft.dirty = false
    draft.hasCommitEffects = false
}

/** Unsets or deletes force the multi-pass settlement arm; plain staged values
 *  keep the bulk-write fast paths. */
export const draftHasCleanupMutations = (draft: MutationDraft): boolean =>
    !!(draft.unsets?.size || draft.deletes?.size)
