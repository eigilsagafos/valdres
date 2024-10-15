import { isFamilyAtom } from "../utils/isFamilyAtom"
import { updateStateSubscribers } from "./updateStateSubscribers"
import { updateSelectorSubscribers } from "./updateSelectorSubscribers"
import type { Atom } from "../types/Atom"
import type { Selector } from "../types/Selector"
import type { StoreData } from "../types/StoreData"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"

const recursivlyResetSelectorTree = (
    selectors: Set<Selector>,
    data: StoreData,
    clearedSelectors: Set<Selector>,
) => {
    // TODO: What do we do with async selectors? Should they have a "stale while revalidate" kind of logic?
    for (const selector of selectors) {
        if (!clearedSelectors.has(selector)) {
            clearedSelectors.add(selector)
            data.expiredValues.set(selector, data.values.get(selector))
            data.values.delete(selector)
            const consumers = data.stateConsumers.get(selector)
            if (consumers?.size) {
                recursivlyResetSelectorTree(consumers, data, clearedSelectors)
            }
        }
    }
}

export const propagateUpdatedAtoms = (
    atoms: (Atom<any> | AtomFamilyAtom<any, any>)[],
    data: StoreData,
) => {
    const clearedSelectors = new Set<Selector>()
    for (const atom of atoms) {
        const consumers = data.stateConsumers.get(atom)
        if (consumers && consumers.size) {
            recursivlyResetSelectorTree(consumers, data, clearedSelectors)
        }

        if (isFamilyAtom(atom)) {
            const consumersFamily = data.stateConsumers.get(atom.family)
            if (consumersFamily?.size) {
                recursivlyResetSelectorTree(
                    consumersFamily,
                    data,
                    clearedSelectors,
                )
            }
        }
    }

    for (const selector of clearedSelectors) {
        updateSelectorSubscribers(selector, data)
    }

    for (const atom of atoms) {
        updateStateSubscribers(atom, data)
    }
}
