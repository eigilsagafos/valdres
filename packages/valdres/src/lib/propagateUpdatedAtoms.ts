import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { Selector } from "../types/Selector"
import type { StoreData } from "../types/StoreData"
import { isAtomFamily } from "../utils/isAtomFamily"
import { isFamilyAtom } from "../utils/isFamilyAtom"
import { initSelector } from "./initSelector"
import { updateSelectorSubscribers } from "./updateSelectorSubscribers"
import { updateStateSubscribers } from "./updateStateSubscribers"

const revalidate = (selector: Selector, data: StoreData) => {
    try {
        return initSelector(selector, data)
    } catch (e) {
        data.expiredValues.set(selector, data.values.get(selector))
        data.values.delete(selector)
        return true
    }
}

const recursivlyResetSelectorTree = (
    selectors: Set<Selector>,
    data: StoreData,
    clearedSelectors: Set<Selector>,
) => {
    // TODO: What do we do with async selectors? Should they have a "stale while revalidate" kind of logic?
    for (const selector of selectors) {
        if (!clearedSelectors.has(selector)) {
            /**
             * TODO: We could improve this by only triggering init if there are subsribers.
             * we just have to handle cases were dependents do have subsribers, so this is
             * a balance between simplicity/complexity and performance.
             * So right now we are not using the expiredValues concept. We might want to do
             * some kind of recursive 2-pass
             * */
            // data.expiredValues.set(selector, data.values.get(selector))
            // data.values.delete(selector)
            const subscribers = data.subscriptions.get(selector)
            const dependents = data.stateDependents.get(selector)

            if (!dependents && !subscribers) {
                data.expiredValues.set(selector, data.values.get(selector))
                data.values.delete(selector)
            } else if (dependents && subscribers) {
                if (dependents.size === 0) throw new Error("Should not happen")
                if (subscribers.size === 0) throw new Error("Should not happen")
                const isValueUpdated = revalidate(selector, data)
                if (isValueUpdated) {
                    recursivlyResetSelectorTree(
                        dependents,
                        data,
                        clearedSelectors,
                    )
                    updateSelectorSubscribers(selector, data)
                }
            } else if (dependents) {
                if (dependents.size === 0) throw new Error("Should not happen")
                const valueUpdated = revalidate(selector, data)
                if (valueUpdated) {
                    recursivlyResetSelectorTree(
                        dependents,
                        data,
                        clearedSelectors,
                    )
                }
            } else if (subscribers) {
                if (subscribers.size === 0) throw new Error("Should not happen")
                const isValueUpdated = revalidate(selector, data)

                if (isValueUpdated) {
                    updateSelectorSubscribers(selector, data)
                }
            }
        }
    }
}

export const propagateUpdatedAtoms = (
    atoms: (Atom<any> | AtomFamilyAtom<any, any> | AtomFamily<any, any>)[],
    data: StoreData,
) => {
    const clearedSelectors = new Set<Selector>()
    for (const atom of atoms) {
        const dependents = data.stateDependents.get(atom)

        if (dependents && dependents.size) {
            recursivlyResetSelectorTree(dependents, data, clearedSelectors)
        }

        if (isFamilyAtom(atom)) {
            const consumersFamily = data.stateDependents.get(atom.family)
            if (consumersFamily?.size) {
                recursivlyResetSelectorTree(
                    consumersFamily,
                    data,
                    clearedSelectors,
                )
            }
        }
    }

    // for (const selector of clearedSelectors) {
    //     updateSelectorSubscribers(selector, data)
    // }

    for (const atom of atoms) {
        if (isAtomFamily(atom)) continue // If atom is an actual atomFamily we don't do anything
        updateStateSubscribers(atom, data)
    }
}
