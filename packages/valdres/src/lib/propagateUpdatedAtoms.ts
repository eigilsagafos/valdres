import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { Family } from "../types/Family"
import type { Selector } from "../types/Selector"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import type { Subscription } from "../types/Subscription"
import { isFamilyAtom } from "../utils/isFamilyAtom"
import { isPromiseLike } from "../utils/isPromiseLike"
import { evaluateSelector } from "./initSelector"
import { setValueInData } from "./setValueInData"

const reEvaluteSelector = (
    selector: Selector,
    data: StoreData,
    updatedAtoms: Set<Atom>,
) => {
    const existingValue = data.values.get(selector)
    try {
        const udpatedValue = evaluateSelector(selector, data, updatedAtoms)

        if (selector.equal(existingValue, udpatedValue, updatedAtoms)) {
            return [false, false]
        } else {
            setValueInData(selector, udpatedValue, data)
            return [true, false]
        }
    } catch (error) {
        data.expiredValues.set(selector, data.values.get(selector))
        data.values.delete(selector)
        return [true, true, error]
    }
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

export const addFamilyAtomsToSet = (
    family: Family<any>,
    familyAtoms: Set<AtomFamilyAtom<any>>,
    data: StoreData,
) => {
    const currentAtoms = findInClosestStore(family, data) || []
    const atomsToAdd = []
    for (const familyAtom of familyAtoms) {
        if (!currentAtoms.includes(familyAtom)) {
            atomsToAdd.push(familyAtom)
        }
    }
    if (atomsToAdd.length > 0) {
        data.values.set(family, [...currentAtoms, ...atomsToAdd])
    }
}

export const propagateUpdatedAtoms = (
    atoms: (Atom<any> | AtomFamilyAtom<any, any> | AtomFamily<any, any>)[],
    data: StoreData,
    subscriptions: Set<Subscription> = new Set(),
    families: Map<AtomFamily<any>, Set<AtomFamilyAtom<any>>> = new Map(),
    isRecursive = false,
) => {
    // const subscriptions = new Set<Subscription>()
    // const families = new Map<AtomFamily<any>>()
    const selectors = new Set<Selector>()
    for (const atom of atoms) {
        addSetToSet(data.stateDependents.get(atom), selectors)
        addSetToSet(data.subscriptions.get(atom), subscriptions)

        if (isFamilyAtom(atom)) {
            // atom.family
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

            addFamilyAtomsToSet(family, familyAtoms, data)
        }
    }

    if (!isRecursive) {
        propagateDirtySelectors(atoms, selectors, data, subscriptions, families)
    }
}

export const propagateDirtySelectors = (
    updatedAtoms: Atom[],
    selectors: Set<Selector>,
    data: StoreData,
    subscriptions: Set<Subscription>,
    families: Map<AtomFamily<any>, Set<AtomFamilyAtom<any>>>,
) => {
    const initialUpdatedAtoms = new Set(updatedAtoms)
    const updatedInitializedAtoms = new Set<Atom>(initialUpdatedAtoms)
    if (selectors.size > 0) {
        // At this point we have the first level of selectors that are depeendent on
        // the atoms that changed. We should now traverse the tree of selectors, collect subsribers
        // to those that change, and keep track of all selectors that we have visited.
        recursivlyHandleSelectorUpdates(
            selectors,
            data,
            subscriptions,
            updatedInitializedAtoms,
        )
    }
    const addedAtoms = initialUpdatedAtoms.symmetricDifference(
        updatedInitializedAtoms,
    )
    if (addedAtoms.size) {
        // propagateUpdatedAtoms
        console.log("addedAtoms", addedAtoms)
        console.log("Valdres TODO: Support this case with new atoms added")
        // throw new Error(
        //     "Handle this case. Is probably if a selector initializes an atom",
        // )
    }
    if (subscriptions.size > 0) {
        for (const subscription of subscriptions) {
            if ("state" in subscription) {
                const updatedFamilyAtoms = families.get(subscription.state)
                if (updatedFamilyAtoms) {
                    for (const atom of updatedFamilyAtoms) {
                        subscription.callback(...atom.familyArgs)
                    }
                }
            } else {
                subscription.callback()
            }
        }
    }
}

const findAllDependents = (
    selector: Selector,
    data: StoreData,
    depsRes = new Set(),
    subsRes = new Set<any>(),
) => {
    const dependents = data.stateDependents.get(selector)
    const subscriptions = data.subscriptions.get(selector)
    addSetToSet(dependents, depsRes)
    addSetToSet(subscriptions, subsRes)
    if (dependents && dependents.size > 0) {
        for (const dependent of dependents) {
            if (depsRes.has(dependent)) continue
            findAllDependents(dependent, data, depsRes, subsRes)
        }
    }
    return [depsRes, subsRes]
}

// const generateDependencyGraph = (state: State, data: StoreData) => {
//     const dependents = data.stateDependents.get(state)
//     return [
//         state.name,
//         dependents
//             ? Array.from(dependents).map(dep =>
//                   generateDependencyGraph(dep, data),
//               )
//             : [],
//         // Array.from(dependents).map(dep => generateDependencyGraph(dep, data)),
//     ]
// }

const recursivlyHandleSelectorUpdates = (
    selectors: Set<Selector>,
    data: StoreData,
    collectedSubscribers: Set<any>,
    updatedInitializedAtoms: Set<Atom>,
    seen: Set<Selector> = new Set(),
) => {
    const selectorsForNextPass = new Set<Selector>()
    for (const selector of selectors) {
        const currentValue = data.values.get(selector)
        if (isPromiseLike(currentValue)) {
            continue
        }
        seen.add(selector)
        const dependents = data.stateDependents.get(selector)
        const subscribers = data.subscriptions.get(selector)
        if (
            (!dependents || dependents.size === 0) &&
            (!subscribers || subscribers.size === 0)
        ) {
            data.expiredValues.set(selector, data.values.get(selector))
            data.values.delete(selector)
        } else {
            const [wasValueUpdated, didEvalCrash, error] = reEvaluteSelector(
                selector,
                data,
                updatedInitializedAtoms,
            )
            if (didEvalCrash) {
                const [deps, subs] = findAllDependents(selector, data)
                if (deps.size > 0) {
                    for (const dep of deps) {
                        data.expiredValues.set(dep, data.values.get(dep))
                        data.values.delete(dep)
                    }
                }
                if (subs.size > 0) {
                    addSetToSet(subs, collectedSubscribers)
                }
            } else {
                if (!wasValueUpdated) continue
                addSetToSet(
                    data.stateDependents.get(selector),
                    selectorsForNextPass,
                )
                addSetToSet(subscribers, collectedSubscribers)
            }

            // We intentially get the dependents again, since the reevalute might have changed the dependents
        }
    }
    if (selectorsForNextPass.size > 0) {
        recursivlyHandleSelectorUpdates(
            selectorsForNextPass,
            data,
            collectedSubscribers,
            updatedInitializedAtoms,
            seen,
        )
    }
}
