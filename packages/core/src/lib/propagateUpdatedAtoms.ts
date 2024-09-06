import type { Atom } from "../types/Atom"
import type { Selector } from "../types/Selector"
import type { StoreData } from "../types/StoreData"
import { updateStateSubscribers } from "./updateStateSubscribers"

const recursivlyResetSelectorTree = (
    selectors: Set<Selector>,
    data: StoreData,
    clearedSelectors: Set<Selector>,
) => {
    // TODO: What do we do with async selectors? Should they have a "stale while revalidate" kind of logic?
    for (const selector of selectors) {
        if (!clearedSelectors.has(selector)) {
            clearedSelectors.add(selector)
            data.values.delete(selector)
            const consumers = data.stateConsumers.get(selector)
            if (consumers?.size) {
                recursivlyResetSelectorTree(consumers, data, clearedSelectors)
            }
        }
    }
}

export const propagateUpdatedAtoms = (atoms: Atom[], data: StoreData) => {
    const clearedSelectors = new Set<Selector>()

    for (const atom of atoms) {
        const consumers = data.stateConsumers.get(atom)
        if (consumers && consumers.size) {
            recursivlyResetSelectorTree(consumers, data, clearedSelectors)
        }
    }

    for (const selector of clearedSelectors) {
        updateStateSubscribers(selector, data)
    }

    for (const atom of atoms) {
        updateStateSubscribers(atom, data)
    }
}
