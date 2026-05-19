import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { StoreData } from "../types/StoreData"

/**
 * Mutable accumulator threaded through index hooks during a single
 * propagation pass. The caller initializes it (typically as `{}`), passes
 * it to every descriptor invocation, and reads the result to drive
 * propagation:
 *
 * - `local` collects dirty atoms in the *writing* scope. Their
 *   stateDependents and subscriptions get merged into the in-progress
 *   propagation pass.
 * - `cross` collects dirty atoms per descendant scope. After
 *   `propagateDirtySelectors` runs locally, the caller dispatches a fresh
 *   `propagateUpdatedAtoms` per scope to fire scope-local subscribers and
 *   selectors.
 *
 * Both fields are lazily allocated — descriptors that produce no dirty
 * atoms pay zero allocation cost.
 */
export type IndexHookResult = {
    local?: Set<Atom<any>>
    cross?: Map<StoreData, Set<Atom<any>>>
}

/**
 * Per-family index extension point. Two synchronous hooks fire during
 * `addFamilyAtomsToSet` (write/init) and `deleteFamilyAtomsFromSet`
 * (delete) — once per atom touched. Implementations maintain their own
 * storage in `data.values` keyed by the descriptor reference and push
 * dirty atoms into `accum` for propagation.
 *
 * **Error contract.** Hooks should not throw under normal operation.
 * If they do, the host catches and logs via `console.error` then
 * continues with the next descriptor — the user-facing write completes
 * but the offending descriptor's index may be in an inconsistent state.
 * Authors should design hooks to be exception-safe (e.g. wrap I/O,
 * validate inputs, no partial bucket mutations).
 *
 * **Lifecycle.** Descriptors are attached via `family.__valdresIndexes`
 * and only see writes that happen *after* attachment. Pre-existing
 * family atoms are not retroactively indexed. An async "populate from
 * existing family state" API is a planned follow-up — design the
 * descriptor's storage so it can absorb a stream of `onWrite` calls in
 * any order without affecting correctness.
 */
export type IndexDescriptor = {
    onWrite: (
        family: AtomFamily<any, any>,
        atom: AtomFamilyAtom<any, any>,
        data: StoreData,
        accum: IndexHookResult,
    ) => void
    onDelete: (
        family: AtomFamily<any, any>,
        atom: AtomFamilyAtom<any, any>,
        data: StoreData,
        accum: IndexHookResult,
    ) => void
}
