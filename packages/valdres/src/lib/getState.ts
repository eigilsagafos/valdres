import { equal } from "./equal"
import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { Family } from "../types/Family"
import type { Selector } from "../types/Selector"
import type { StoreData } from "../types/StoreData"
import { isAtom } from "../utils/isAtom"
import { isAtomFamily } from "../utils/isAtomFamily"
import { isSelector } from "../utils/isSelector"
import { isSelectorFamily } from "../utils/isSelectorFamily"
import { initAtom } from "./initAtom"
import { initSelector } from "./initSelector"

export function getState<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    atom: Atom<Value>,
    data: StoreData,
    circularDependencySet?: WeakSet<Selector>,
): Value

export function getState<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    selector: Selector<Value>,
    data: StoreData,
    circularDependencySet?: WeakSet<Selector>,
): Value

export function getState<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    family: AtomFamily<Value, Args>,
    data: StoreData,
    circularDependencySet?: WeakSet<Selector>,
): Args[]

export function getState<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    state: Atom<Value> | Selector<Value> | Family<Value, Args>,
    data: StoreData,
    circularDependencySet?: WeakSet<Selector>,
) {
    if (data.values.has(state)) return data.values.get(state)
    if (isAtom<Value>(state)) {
        if ("parent" in data)
            return getState<Value, Args>(
                state,
                data.parent,
                circularDependencySet,
            )
        return initAtom<Value, Args>(state, data)
    }
    if (isSelector<Value>(state))
        return initSelector<Value>(state, data, circularDependencySet)
    if (isAtomFamily<Value, Args>(state)) {
        if ("parent" in data) {
            const closestData = findClosestStoreWithAtomInitialized<Set<Args>>(
                state.__keysAtom,
                data,
            )
            return getState<Value, Args>(
                // @ts-ignore @ts-todo
                state.__keysSelector,
                closestData,
                circularDependencySet,
            )
        }
        return getState<Value, Args>(
            // @ts-ignore @ts-todo
            state.__keysSelector,
            data,
            circularDependencySet,
        )
    }
    if (isSelectorFamily<Value, Args>(state)) {
        // TODO: Impement more efficient way to solve this
        const array = Array.from(state.__valdresSelectorFamilyMap.keys())
        // @ts-ignore
        if (equal(array, state._keyArray)) return state._keyArray
        // @ts-ignore
        state._keyArray = array
        return array
    }
    throw new Error("Invalid object passed to get")
}

const findClosestStoreWithAtomInitialized = <V>(
    atom: Atom<V>,
    data: StoreData,
) => {
    if ("parent" in data === false) return data
    if (data.values.has(atom)) return data
    return findClosestStoreWithAtomInitialized(atom, data.parent)
}
