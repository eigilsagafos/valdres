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
export class FamilyIndex {
    map: Map<AtomFamilyAtom<any>, boolean>
    family: AtomFamily<any>
    data: StoreData
    parentIndex: FamilyIndex | undefined
    constructor(
        family: AtomFamily<any>,
        data: StoreData,
        parentIndex?: FamilyIndex,
        map?: Map<AtomFamilyAtom<any>, boolean>,
    ) {
        this.family = family
        this.data = data
        this.parentIndex = parentIndex
        this.map = new Map(map)
    }

    add(atoms) {
        atoms.forEach(atom => {
            this.map.set(atom, true)
        })
    }

    delete(atoms) {
        atoms.forEach(atom => {
            this.map.set(atom, false)
        })
    }

    has(atom) {
        return this.map.has(atom)
    }

    clone() {
        return new FamilyIndex(
            this.family,
            this.data,
            this.parentIndex,
            this.map,
        )
    }

    toSet() {
        let set

        if (this.parentIndex) {
            set = new Set(this.parentIndex.toSet())
        } else {
            set = new Set()
        }
        for (const [key, value] of this.map) {
            if (value === true) set.add(key)
            if (value === false) set.delete(key)
        }

        return set
    }

    toArray() {
        const arr = [...this.toSet()]
        arr.__index = this
        return arr
    }
}

export const deleteFamilyAtomsFromSet = (
    family: Family<any>,
    familyAtoms: Set<AtomFamilyAtom<any>>,
    data: StoreData,
) => {
    const index = findFamilyIndex(family, data)
    index.delete(familyAtoms)
    data.values.set(family, index.toArray())
    recursivlyUpdateIndexes(data, family)
}

const initFamilyIndex = (family, data: StoreData) => {
    if (data.values.has(family)) return
    if ("parent" in data) {
        initFamilyIndex(family, data.parent)
        const parentIndex = data.parent.values.get(family).__index
        if (!parentIndex) throw new Error("Parent index is missing")
        const index = new FamilyIndex(family, data, parentIndex)
        data.values.set(family, index.toArray())
    } else {
        const index = new FamilyIndex(family, data)
        data.values.set(family, index.toArray())
    }
}

const findFamilyIndex = (family, data) => {
    if (!data.values.has(family)) {
        initFamilyIndex(family, data)
    }
    const value = data.values.get(family)
    if (!value?.__index) {
        console.log("value", value)
        throw new Error("Family index is missing")
    }

    return value.__index
}

const recursivlyUpdateIndexes = (data: StoreData, family) => {
    Object.keys(data.scopes).forEach(scopeKey => {
        const scopedData = data.scopes[scopeKey]
        if (scopeKey) {
            if (scopedData.values.has(family)) {
                scopedData.values.set(
                    family,
                    scopedData.values.get(family).__index.toArray(),
                )
            }
            recursivlyUpdateIndexes(scopedData, family)
        }
    })
}

export const addFamilyAtomsToSet = (
    family: Family<any>,
    familyAtoms: Set<AtomFamilyAtom<any>>,
    data: StoreData,
) => {
    const index = findFamilyIndex(family, data)
    index.add(familyAtoms)
    data.values.set(family, index.toArray())
    recursivlyUpdateIndexes(data, family)
}

export const propagateDeletedAtoms = (
    atoms,
    data: StoreData,
    subscriptions: Set<Subscription> = new Set(),
    families: Map<AtomFamily<any>, Set<AtomFamilyAtom<any>>> = new Map(),
) => {
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

            deleteFamilyAtomsFromSet(family, familyAtoms, data)
        }
    }
    propagateDirtySelectors(atoms, selectors, data, subscriptions, families)
    //    if (!isRecursive) {
    // }
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
            if (!wasValueUpdated) continue
            addSetToSet(
                data.stateDependents.get(selector), // We intentially get the dependents again, since the reevalute might have changed the dependents
                selectorsForNextPass,
            )
            addSetToSet(subscribers, collectedSubscribers)
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
