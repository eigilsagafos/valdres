import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { valdresGlobal } from "./valdresGlobal"

export type AsyncAtomCoordinatorEntry = {
    promise: PromiseLike<any>
}

const coordinatorsByStore = valdresGlobal().runtime.asyncAtomCoordinators

export const getAsyncAtomCoordinatorEntry = (
    atom: Atom<any>,
    value: PromiseLike<any>,
    data: StoreData,
): AsyncAtomCoordinatorEntry | undefined => {
    const coordinator = coordinatorsByStore.get(data)?.get(atom)
    return coordinator?.promise === value ? coordinator : undefined
}

export const setAsyncAtomCoordinatorEntry = (
    atom: Atom<any>,
    data: StoreData,
    coordinator: AsyncAtomCoordinatorEntry,
) => {
    let coordinators = coordinatorsByStore.get(data)
    if (!coordinators) {
        coordinators = new WeakMap()
        coordinatorsByStore.set(data, coordinators)
    }
    coordinators.set(atom, coordinator)
}

export const clearAsyncAtomCoordinatorEntry = (
    atom: Atom<any>,
    data: StoreData,
    coordinator: AsyncAtomCoordinatorEntry,
) => {
    const coordinators = coordinatorsByStore.get(data)
    if (coordinators?.get(atom) === coordinator) coordinators.delete(atom)
}

/** Retire a coordinator when another write path replaces its Promise. Called
 * only from branches that already found a promise-valued current value, so the
 * ordinary settled write path never touches this registry. */
export const clearSupersededAsyncAtomCoordinator = (
    atom: Atom<any>,
    data: StoreData,
) => coordinatorsByStore.get(data)?.delete(atom)
