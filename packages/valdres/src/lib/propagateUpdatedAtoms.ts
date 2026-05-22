import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { Family } from "../types/Family"
import type { Selector } from "../types/Selector"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import type { Subscription } from "../types/Subscription"
import { isAtomFamily } from "../utils/isAtomFamily"
import { isFamilyAtom } from "../utils/isFamilyAtom"
import { isPromiseLike } from "../utils/isPromiseLike"
import {
    addFamilyAtomsToSet,
    deleteFamilyAtomsFromSet,
} from "./atomFamilyIndex"
import {
    evaluateSelector,
    handleSelectorResult,
} from "./initSelector"
import {
    isLive,
    mountTransitiveDeps,
    onLiveDependencyAdded,
    onLiveDependencyRemoved,
    unmountOrphanedDeps,
} from "./mountAtom"
import { setValueInData } from "./setValueInData"

export type {
    AtomFamilyIndex,
} from "./atomFamilyIndex"
export {
    cloneAtomFamilyIndex,
    createAtomFamilyIndex,
    renderAtomFamilyIndex,
} from "./atomFamilyIndex"

type AtomInput = Atom<any> | AtomFamilyAtom<any, any> | AtomFamily<any, any>

const reEvaluteSelector = (
    selector: Selector,
    data: StoreData,
    updatedAtoms: Set<Atom>,
): [boolean, boolean, unknown, Set<State>, Set<State>] => {
    const existingValue = data.values.get(selector)
    const addedDeps = new Set<State>()
    const removedDeps = new Set<State>()
    try {
        const rawValue = evaluateSelector(
            selector,
            data,
            updatedAtoms,
            undefined,
            addedDeps,
            removedDeps,
        )
        const udpatedValue = handleSelectorResult(rawValue, selector, data)

        // Use reference equality for promises — deep equal treats all
        // promises as structurally identical (both have zero own keys).
        const areEqual =
            isPromiseLike(existingValue) || isPromiseLike(udpatedValue)
                ? existingValue === udpatedValue
                : selector.equal(existingValue, udpatedValue, updatedAtoms)
        if (areEqual) {
            return [false, false, undefined, addedDeps, removedDeps]
        } else {
            setValueInData(selector, udpatedValue, data)
            return [true, false, undefined, addedDeps, removedDeps]
        }
    } catch (error) {
        data.values.delete(selector)
        return [true, true, error, addedDeps, removedDeps]
    }
}

const callSubscribers = (
    subscriptions: Set<Subscription>,
    families?: Map<AtomFamily<any>, Set<AtomFamilyAtom<any>>>,
) => {
    let firstError: unknown
    let hasError = false
    for (const subscription of subscriptions) {
        if ("state" in subscription) {
            const updatedFamilyAtoms = families?.get(subscription.state)
            if (updatedFamilyAtoms) {
                for (const atom of updatedFamilyAtoms) {
                    try {
                        subscription.callback(...atom.familyArgs)
                    } catch (error) {
                        if (!hasError) {
                            firstError = error
                            hasError = true
                        }
                    }
                }
            }
        } else {
            try {
                subscription.callback()
            } catch (error) {
                if (!hasError) {
                    firstError = error
                    hasError = true
                }
            }
        }
    }
    if (hasError) throw firstError
}

const addSetToSet = (fromSet: Set<any> | undefined, toSet: Set<any>) => {
    if (fromSet && fromSet.size > 0) {
        for (const item of fromSet) {
            toSet.add(item)
        }
    }
}

const findClosestStoreWithAtomInitialized = (
    atom: State | Family<any>,
    data: StoreData,
) => {
    if ("parent" in data === false) return data
    if (data.values.has(atom)) return data
    return findClosestStoreWithAtomInitialized(atom, data.parent)
}

const findInClosestStore = (
    state: State<any> | Family<any>,
    data: StoreData,
) => {
    const store = findClosestStoreWithAtomInitialized(state, data)
    return store.values.get(state)
}

export const propagateDeletedAtoms = (
    atoms: AtomFamilyAtom<any, any>[],
    data: StoreData,
    subscriptions: Set<Subscription> = new Set(),
    families: Map<AtomFamily<any>, Set<AtomFamilyAtom<any>>> = new Map(),
    timestamp = performance.now(),
) => {
    const selectors = new Set<Selector>()
    for (const atom of atoms) {
        addSetToSet(data.stateDependents.get(atom), selectors)
        addSetToSet(data.subscriptions.get(atom), subscriptions)

        if (isFamilyAtom(atom)) {
            if (!families.has(atom.family)) {
                families.set(atom.family, new Set())
            }
            // @ts-ignore
            families.get(atom.family).add(atom)
        }
    }
    if (families.size > 0) {
        for (const [family, familyAtoms] of families) {
            addSetToSet(data.stateDependents.get(family), selectors)
            addSetToSet(data.subscriptions.get(family), subscriptions)
            if (familyAtoms.size === 0)
                throw new Error("Should not be possible")

            deleteFamilyAtomsFromSet(family, familyAtoms, data, timestamp)
        }
    }
    propagateDirtySelectors(atoms, selectors, data, subscriptions, families)
    // Propagate family changes into child scopes. deleteFamilyAtomsFromSet
    // already updated each scope's family index via recursivelyUpdateIndexes;
    // selectors in those scopes that depend on the family still need to be
    // re-evaluated so their subscribers get notified.
    if (families.size > 0 && data.scopes && data.scopes.size > 0) {
        const scopeFamilies = new Map<StoreData, AtomFamily<any>[]>()
        for (const family of families.keys()) {
            const scopesWithFamily = data.scopeValueIndex.get(family)
            if (scopesWithFamily) {
                for (const scope of scopesWithFamily) {
                    let list = scopeFamilies.get(scope)
                    if (!list) {
                        list = []
                        scopeFamilies.set(scope, list)
                    }
                    list.push(family)
                }
            }
        }
        for (const [scope, familiesInScope] of scopeFamilies) {
            propagateInScope(familiesInScope, scope)
        }
    }
}

// Top-level entry: notify direct atom subscribers, walk dependent selectors,
// then cross-propagate into scopes.
export const propagateAtomUpdate = (
    atoms: AtomInput[],
    data: StoreData,
    isInitOnly = false,
) => {
    // Fast path: single non-family atom with no dependent selectors and no
    // scopes can skip the full graph walk entirely and just notify subscribers.
    if (atoms.length === 1) {
        const atom = atoms[0]
        if (!isFamilyAtom(atom) && !isAtomFamily(atom)) {
            const dependents = data.stateDependents.get(atom)
            if (
                (!dependents || dependents.size === 0) &&
                (!data.scopes || data.scopes.size === 0)
            ) {
                const subs = data.subscriptions.get(atom)
                if (subs && subs.size > 0) {
                    callSubscribers(subs)
                }
                return
            }
        }
    }

    const subscriptions = new Set<Subscription>()
    const families = new Map<AtomFamily<any>, Set<AtomFamilyAtom<any>>>()
    const selectors = new Set<Selector>()

    for (const atom of atoms) {
        addSetToSet(data.stateDependents.get(atom), selectors)
        addSetToSet(data.subscriptions.get(atom), subscriptions)
        if (isFamilyAtom(atom)) {
            if (!families.has(atom.family)) {
                families.set(atom.family, new Set())
            }
            // @ts-ignore
            families.get(atom.family).add(atom)
        }
    }

    if (families.size > 0) {
        const timestamp = performance.now()
        for (const [family, familyAtoms] of families) {
            addSetToSet(data.stateDependents.get(family), selectors)
            addSetToSet(data.subscriptions.get(family), subscriptions)
            if (familyAtoms.size === 0)
                throw new Error("Should not be possible")
            addFamilyAtomsToSet(family, familyAtoms, data, timestamp)
        }
    }

    propagateDirtySelectors(atoms, selectors, data, subscriptions, families, isInitOnly)

    if (data.scopes && data.scopes.size > 0) {
        propagateToScopes(atoms, data, isInitOnly)
    }
}

// Scope-recursive entry: re-evaluate selectors that depend on these atoms in
// this scope and cross into nested scopes. Skips collecting direct atom and
// family subscribers — the parent scope already notified those, and family
// index bookkeeping has already cascaded via recursivelyUpdateIndexes.
export const propagateInScope = (
    atoms: AtomInput[],
    data: StoreData,
    isInitOnly = false,
) => {
    const subscriptions = new Set<Subscription>()
    const families = new Map<AtomFamily<any>, Set<AtomFamilyAtom<any>>>()
    const selectors = new Set<Selector>()

    for (const atom of atoms) {
        addSetToSet(data.stateDependents.get(atom), selectors)
    }

    propagateDirtySelectors(atoms, selectors, data, subscriptions, families, isInitOnly)

    if (data.scopes && data.scopes.size > 0) {
        propagateToScopes(atoms, data, isInitOnly)
    }
}

const propagateToScopes = (
    atoms: AtomInput[],
    data: StoreData,
    isInitOnly: boolean,
) => {
    if (atoms.length === 1) {
        // Fast path for single-atom updates (most common case)
        const atom = atoms[0]
        const shadowingScopes = isAtomFamily(atom)
            ? undefined
            : data.scopeValueIndex.get(atom)
        for (const [, scope] of data.scopes) {
            if (!shadowingScopes || !shadowingScopes.has(scope)) {
                propagateInScope(atoms, scope, isInitOnly)
            }
        }
        return
    }

    // Multi-atom path: precompute shadow sets once
    let anyShadowed = false
    let atomShadows: Map<any, Set<any>> | undefined
    for (const atom of atoms) {
        if (!isAtomFamily(atom)) {
            const s = data.scopeValueIndex.get(atom)
            if (s && s.size > 0) {
                if (!atomShadows) atomShadows = new Map()
                atomShadows.set(atom, s)
                anyShadowed = true
            }
        }
    }

    if (!anyShadowed) {
        for (const [, scope] of data.scopes) {
            propagateInScope(atoms, scope, isInitOnly)
        }
        return
    }

    // Some atoms are shadowed, filter per scope
    for (const [, scope] of data.scopes) {
        const atomsToUpdateInScope: AtomInput[] = []
        for (const atom of atoms) {
            if (isAtomFamily(atom)) {
                // The scope has its own family index, but the parent
                // index may have changed (e.g. a member was deleted
                // from root). Re-evaluate dependent selectors in the
                // scope so subscribers get notified.
                atomsToUpdateInScope.push(atom)
            } else {
                const s = atomShadows!.get(atom)
                if (!s || !s.has(scope)) {
                    atomsToUpdateInScope.push(atom)
                }
            }
        }
        if (atomsToUpdateInScope.length > 0) {
            propagateInScope(atomsToUpdateInScope, scope, isInitOnly)
        }
    }
}

export const propagateDirtySelectors = (
    updatedAtoms: Atom[],
    selectors: Set<Selector>,
    data: StoreData,
    subscriptions: Set<Subscription>,
    families: Map<AtomFamily<any>, Set<AtomFamilyAtom<any>>>,
    isInitOnly = false,
) => {
    const updatedInitializedAtoms = new Set<Atom>(updatedAtoms)
    if (selectors.size > 0) {
        // At this point we have the first level of selectors that are dependent on
        // the atoms that changed. We now traverse the tree of selectors and collect
        // subscribers to those that change.
        propagateSelectorUpdates(
            selectors,
            data,
            subscriptions,
            updatedInitializedAtoms,
            isInitOnly,
        )
    }
    if (subscriptions.size > 0) {
        callSubscribers(subscriptions, families)
    }
}


const propagateSelectorUpdates = (
    selectors: Set<Selector>,
    data: StoreData,
    collectedSubscribers: Set<any>,
    updatedInitializedAtoms: Set<Atom>,
    isInitOnly = false,
) => {
    let currentSelectors = selectors
    while (currentSelectors.size > 0) {
        const selectorsForNextPass = new Set<Selector>()
        for (const selector of currentSelectors) {
            const currentValue = data.values.get(selector)
            if (isPromiseLike(currentValue) && isInitOnly) {
                // During init-time propagation, skip promise-valued selectors
                // to avoid double-evaluation.
                continue
            }
            const dependents = data.stateDependents.get(selector)
            const subscribers = data.subscriptions.get(selector)
            if (
                !isPromiseLike(currentValue) &&
                (!dependents || dependents.size === 0) &&
                (!subscribers || subscribers.size === 0)
            ) {
                // Invalidate unsubscribed non-promise selectors for lazy
                // re-eval on next read.
                data.values.delete(selector)
            } else {
                const [wasValueUpdated, didEvalCrash, error, addedDeps, removedDeps] =
                    reEvaluteSelector(selector, data, updatedInitializedAtoms)
                // Mount/unmount dependencies that changed if this selector is
                // live (i.e. someone is transitively listening). Also update
                // liveness contributions on each added/removed dep BEFORE the
                // mount/unmount so isLive reflects the new topology.
                if (
                    (addedDeps.size > 0 || removedDeps.size > 0) &&
                    isLive(selector, data)
                ) {
                    for (const dep of addedDeps) {
                        onLiveDependencyAdded(dep, data)
                        mountTransitiveDeps(dep, data)
                    }
                    for (const dep of removedDeps) {
                        onLiveDependencyRemoved(dep, data)
                        unmountOrphanedDeps(dep, data)
                    }
                }
                if (!wasValueUpdated) continue
                addSetToSet(
                    data.stateDependents.get(selector), // We intentionally get the dependents again, since the re-evaluate might have changed the dependents
                    selectorsForNextPass,
                )
                addSetToSet(subscribers, collectedSubscribers)
            }
        }
        currentSelectors = selectorsForNextPass
    }
}
