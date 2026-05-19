import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { Family } from "../types/Family"
import type { Selector } from "../types/Selector"
import type { StoreData } from "../types/StoreData"
import { isAtom } from "../utils/isAtom"
import { isAtomFamily } from "../utils/isAtomFamily"
import { isFamilyAtom } from "../utils/isFamilyAtom"
import { isSelector } from "../utils/isSelector"
import { isSelectorFamily } from "../utils/isSelectorFamily"
import { equal } from "./equal"
import { initAtom } from "./initAtom"
import { initSelector, NeedsInitError, _evalDepth, MAX_EVAL_DEPTH } from "./initSelector"
import {
    createAtomFamilyIndex,
    materializeDirtyFamily,
    renderAtomFamilyIndex,
} from "./atomFamilyIndex"

export function getState<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    atom: Atom<Value>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet?: WeakSet<Selector>,
): Value

export function getState<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    selector: Selector<Value>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet?: WeakSet<Selector>,
): Value

export function getState<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    family: AtomFamily<Value, Args>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet?: WeakSet<Selector>,
): AtomFamilyAtom<Value, Args>[]

export function getState<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    state: Atom<Value> | Selector<Value> | Family<Value, Args>,
    data: StoreData,
    initializedAtomsSet: Set<Atom<any>>,
    circularDependencySet?: WeakSet<Selector>,
) {
    if (data.values.has(state)) {
        // Lazy family-array materialization: writes mark the family
        // dirty without rebuilding the rendered array, so bulk no-txn
        // inserts stay O(N). The first read after a write pays the O(M)
        // render and caches it.
        if (data.dirtyFamilies?.has(state as WeakKey)) {
            return materializeDirtyFamily(state as WeakKey, data)
        }
        return data.values.get(state)
    }
    if (isAtom<Value>(state)) {
        if ("parent" in data)
            return getState<Value, Args>(
                state,
                data.parent,
                initializedAtomsSet,
                circularDependencySet,
            )
        if (isFamilyAtom(state)) {
            const familyValue = data.values.get(state.family)
            if (familyValue?.__index) {
                if (isAtomDeletedInFamilyIndex(state, familyValue.__index)) {
                    return state.defaultValue as Value
                }
            }
        }
        initAtom<Value, Args>(state, data, initializedAtomsSet)
        initializedAtomsSet.add(state)
        return data.values.get(state)
    }
    if (isSelector<Value>(state)) {
        if (_evalDepth >= MAX_EVAL_DEPTH) {
            // Approaching stack limit — signal the trampoline to handle
            // this dependency iteratively instead of recursing deeper.
            throw new NeedsInitError(state)
        }
        initSelector<Value>(
            state,
            data,
            initializedAtomsSet,
            circularDependencySet,
        )
        return data.values.get(state)
    }
    if (isAtomFamily<Value, Args>(state)) {
        if ("parent" in data) {
            const closestData = findClosestStoreWithAtomInitialized<Set<Args>>(
                // @ts-ignore @ts-todo
                state,
                data,
            )
            // @ts-ignore @ts-todo
            return getState<Value, Args>(
                state,
                closestData,
                initializedAtomsSet,
                circularDependencySet,
            )
        }
        data.values.set(state, renderAtomFamilyIndex(createAtomFamilyIndex()))
        initializedAtomsSet.add(state)
        return data.values.get(state)
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

const isAtomDeletedInFamilyIndex = (atom: any, index: any): boolean => {
    if (index.deleted.has(atom)) return true
    if (index.created.has(atom)) return false
    if (index.parentIndex)
        return isAtomDeletedInFamilyIndex(atom, index.parentIndex)
    return false
}
