import type { State } from "../../types/State"
import type { StoreData } from "../../types/StoreData"
import { isAtom } from "../../utils/isAtom"
import { isAtomFamily } from "../../utils/isAtomFamily"

/** Only atoms and atom families read through a scope boundary. Selectors are
 * evaluated per store, so their reverse edges never belong in the branch index. */
const isInheritedState = (state: State) => isAtom(state) || isAtomFamily(state)

/** Recompute whether `data` should be present in its parent's branch set for
 * `state`, then carry an actual membership transition toward the root.
 *
 * A branch is relevant when this store has a local active dependent or a
 * relevant child branch. An atom shadow stops that relevance from escaping to
 * the parent; atom-family indexes are overlays and always inherit membership. */
export const refreshInheritedDependencyBranch = (
    state: State,
    start: StoreData,
) => {
    if (!isInheritedState(state)) return

    let data = start
    while (data.parent) {
        const registeredKeys = data.inheritedDependencyKeys
        const isRegistered = registeredKeys?.has(state) ?? false
        const hasDependent =
            !!data.stateDependents.get(state)?.size ||
            !!data.inheritedDependencyBranches.get(state)?.size
        const inherits = isAtomFamily(state) || !data.values.has(state)
        const shouldRegister = hasDependent && inherits

        // The parent's view of this whole subtree did not change, so no higher
        // ancestor can change either.
        if (isRegistered === shouldRegister) return

        const parent = data.parent
        if (shouldRegister) {
            let branches = parent.inheritedDependencyBranches.get(state)
            if (!branches) {
                branches = new Set()
                parent.inheritedDependencyBranches.set(state, branches)
            }
            branches.add(data)
            ;(data.inheritedDependencyKeys ??= new Set()).add(state)
        } else {
            const branches = parent.inheritedDependencyBranches.get(state)
            if (branches) {
                branches.delete(data)
                if (branches.size === 0) {
                    parent.inheritedDependencyBranches.delete(state)
                }
            }
            registeredKeys?.delete(state)
        }

        data = parent
    }
}

/** Add one committed reverse dependency edge and publish the branch only on
 * the zero-to-one transition for this state in this store. */
export const addStateDependent = (
    state: State,
    dependent: State,
    data: StoreData,
) => {
    let dependents = data.stateDependents.get(state) as Set<State> | undefined
    if (!dependents) {
        dependents = new Set()
        data.stateDependents.set(state, dependents)
    }
    const wasEmpty = dependents.size === 0
    dependents.add(dependent)
    if (wasEmpty && dependents.size !== 0 && data.parent) {
        refreshInheritedDependencyBranch(state, data)
    }
    return dependents
}

/** Remove one committed reverse dependency edge and retract the branch only on
 * the one-to-zero transition for this state in this store. */
export const removeStateDependent = (
    state: State,
    dependent: State,
    data: StoreData,
) => {
    const dependents = data.stateDependents.get(state) as Set<State> | undefined
    if (!dependents || !dependents.delete(dependent)) return false
    if (dependents.size === 0 && data.parent) {
        refreshInheritedDependencyBranch(state, data)
    }
    return true
}

/** True when at least one input has an affected immediate child branch. */
export const hasInheritedDependencyBranches = (
    states: Iterable<State>,
    data: StoreData,
) => {
    if (data.scopes.size === 0) return false
    for (const state of states) {
        if (data.inheritedDependencyBranches.get(state)?.size) return true
    }
    return false
}

/** Remove a scope's registrations from its parent. `propagate` is disabled for
 * descendants while disposing a whole subtree: their parent is being disposed
 * too, and refreshing it could re-register the already-detached subtree root. */
export const detachInheritedDependencyBranches = (
    data: StoreData,
    propagate = true,
) => {
    const parent = data.parent
    const keys = data.inheritedDependencyKeys
    if (!parent || !keys || keys.size === 0) return

    for (const state of [...keys] as State[]) {
        const branches = parent.inheritedDependencyBranches.get(state)
        if (branches) {
            branches.delete(data)
            if (branches.size === 0) {
                parent.inheritedDependencyBranches.delete(state)
            }
        }
        keys.delete(state)
        if (propagate) refreshInheritedDependencyBranch(state, parent)
    }
}
