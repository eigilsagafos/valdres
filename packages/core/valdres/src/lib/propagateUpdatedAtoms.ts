import equal from "fast-deep-equal"
import type { Atom } from "../types/Atom"
import type { Selector } from "../types/Selector"
import type { StoreData } from "../types/StoreData"
import { initSelector } from "./initSelector"
import { updateStateSubscribers } from "./updateStateSubscribers"
import { updateSelectorSubscribers } from "./updateSelectorSubscribers"

const recursivlyResetSelectorTree = (
    selectors: Set<Selector>,
    data: StoreData,
    clearedSelectors: Set<Selector>,
    oldSelectorValues: Map<Selector, any>,
) => {
    // TODO: What do we do with async selectors? Should they have a "stale while revalidate" kind of logic?
    for (const selector of selectors) {
        if (!clearedSelectors.has(selector)) {
            clearedSelectors.add(selector)
            oldSelectorValues.set(selector, data.values.get(selector))
            data.values.delete(selector)
            const consumers = data.stateConsumers.get(selector)
            if (consumers?.size) {
                recursivlyResetSelectorTree(
                    consumers,
                    data,
                    clearedSelectors,
                    oldSelectorValues,
                )
            }
        }
    }
}

export const propagateUpdatedAtoms = (atoms: Atom[], data: StoreData) => {
    const clearedSelectors = new Set<Selector>()
    const oldSelectorValues = new Map()

    for (const atom of atoms) {
        const consumers = data.stateConsumers.get(atom)
        if (consumers && consumers.size) {
            recursivlyResetSelectorTree(
                consumers,
                data,
                clearedSelectors,
                oldSelectorValues,
            )
        }
        if (atom.family) {
            const consumersFamily = data.stateConsumers.get(atom.family)
            if (consumersFamily?.size) {
                recursivlyResetSelectorTree(
                    consumersFamily,
                    data,
                    clearedSelectors,
                    oldSelectorValues,
                )
            }
        }
    }
    for (const selector of clearedSelectors) {
        updateSelectorSubscribers(
            selector,
            data,
            oldSelectorValues.get(selector),
        )
    }

    for (const atom of atoms) {
        updateStateSubscribers(atom, data)
    }
}
