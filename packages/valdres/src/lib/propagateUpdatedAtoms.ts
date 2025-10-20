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

// @ts-ignore
const getAtomFamilyRenderedMap = (
    index: ReturnType<typeof createAtomFamilyIndex>,
) => {
    if (index.rendered) return index.rendered
    // @ts-ignore
    const result = new Map(
        index.parentIndex
            ? getAtomFamilyRenderedMap(index.parentIndex)
            : undefined,
    )

    for (const [atom, timestamp] of index.created) {
        result.set(atom, timestamp)
    }
    for (const [atom, timestamp] of index.deleted) {
        result.delete(atom, timestamp)
    }
    index.rendered = result
    return result
}

const getSortedKeysByValues = <K, V extends number | string>(
    map: Map<K, V>,
): K[] => {
    return Array.from(map.entries())
        .sort((a, b) => (a[1] > b[1] ? 1 : a[1] < b[1] ? -1 : 0))
        .map(entry => entry[0])
    // res.__in
}

export const renderAtomFamilyIndex = (index: AtomFamilyIndex) => {
    if (index.renderedArray) {
        console.log("Using cached rendered array")
        return index.renderedArray
    }
    const renderedMap = getAtomFamilyRenderedMap(index)
    const array = getSortedKeysByValues(renderedMap)
    // @ts-ignore
    array.__index = index
    // @ts-ignore
    index.renderedArray = array
    return array
}

type AtomFamilyIndex = {
    created: Map<AtomFamilyAtom<any, any>, Number>
    deleted: Map<AtomFamilyAtom<any, any>, Number>
    rendered: Map<AtomFamilyAtom<any, any>, Number> | null
    renderedArray:
        | (AtomFamilyAtom<any, any>[] & { __index: AtomFamilyIndex })
        | null
    parentIndex?: AtomFamilyIndex
}

export const cloneAtomFamilyIndex = (
    index: AtomFamilyIndex,
    parentIndexOverride?: AtomFamilyIndex,
): AtomFamilyIndex => {
    return {
        created: new Map(index.created),
        deleted: new Map(index.deleted),
        rendered: null,
        renderedArray: null,
        parentIndex: parentIndexOverride || index.parentIndex,
    }
}

export const createAtomFamilyIndex = (
    parentIndex?: AtomFamilyIndex,
): AtomFamilyIndex => {
    return {
        created: new Map(),
        deleted: new Map(),
        rendered: null, // new Map(parentIndex?.rendered),
        renderedArray: null,
        parentIndex,
    }
}

export const deleteFamilyAtomsFromSet = (
    family: Family<any>,
    familyAtoms: Set<AtomFamilyAtom<any>>,
    data: StoreData,
    timestamp: number,
) => {
    if (familyAtoms.size === 0) return
    const index = findFamilyIndex(family, data)
    for (const atom of familyAtoms) {
        index.deleted.set(atom, timestamp)
    }
    index.rendered = null
    index.renderedArray = null
    data.values.set(family, renderAtomFamilyIndex(index))
    recursivlyUpdateIndexes(data, family)
}

const initFamilyIndex = (family: Family<any>, data: StoreData) => {
    if (data.values.has(family)) return data.values.get(family).__index
    let parentIndex
    if ("parent" in data) {
        parentIndex = initFamilyIndex(family, data.parent)
        if (!parentIndex) throw new Error("Parent index is missing")
    }
    const index = createAtomFamilyIndex(parentIndex)
    data.values.set(family, renderAtomFamilyIndex(index))
    return index
}

const findFamilyIndex = (family: Family<any>, data: StoreData) => {
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

const recursivlyUpdateIndexes = (data: StoreData, family: Family<any>) => {
    Object.keys(data.scopes).forEach(scopeKey => {
        const scopedData = data.scopes[scopeKey]
        if (scopeKey) {
            if (scopedData.values.has(family)) {
                const index = scopedData.values.get(family).__index
                index.rendered = null
                index.renderedArray = null
                scopedData.values.set(family, renderAtomFamilyIndex(index))
            }
            recursivlyUpdateIndexes(scopedData, family)
        }
    })
}

export const addFamilyAtomsToSet = (
    family: Family<any>,
    familyAtoms: Set<AtomFamilyAtom<any>>,
    data: StoreData,
    timestamp: Number,
) => {
    if (familyAtoms.size === 0) return
    const index = findFamilyIndex(family, data)
    if (!index) throw new Error("index not found")
    for (const atom of familyAtoms) {
        index.created.set(atom, timestamp)
        index.deleted.delete(atom)
    }
    index.rendered = null
    index.renderedArray = null
    data.values.set(family, renderAtomFamilyIndex(index))
    recursivlyUpdateIndexes(data, family)
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

            deleteFamilyAtomsFromSet(family, familyAtoms, data, timestamp)
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
    timestamp = performance.now(),
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

            addFamilyAtomsToSet(family, familyAtoms, data, timestamp)
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
