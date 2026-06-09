import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { Family } from "../types/Family"
import type { Selector } from "../types/Selector"
import type { StoreData } from "../types/StoreData"
import { isAtom } from "../utils/isAtom"
import { isAtomFamily } from "../utils/isAtomFamily"
import { isPromiseLike } from "../utils/isPromiseLike"
import { isFamilyAtom } from "../utils/isFamilyAtom"
import { isSelector } from "../utils/isSelector"
import { isSelectorFamily } from "../utils/isSelectorFamily"
import { equal } from "./equal"
import { initAtom } from "./initAtom"
import { initSelector } from "./initSelector"
import { propagateAtomUpdate } from "./propagateUpdatedAtoms"
import { resolveAtomDefaultValue } from "./resolveAtomDefaultValue"
import { setValueInData } from "./setValueInData"
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
        if (data.parent)
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
                    // Resolve the default once and cache it so repeated reads
                    // are stable (same reference) and never re-invoke a
                    // function/async default factory — re-running it on every
                    // read would repeat its side effects (e.g. a fetch). We
                    // deliberately DON'T add `state` to initializedAtomsSet, so
                    // the get-time propagation that re-registers a member in the
                    // family index never runs: the member stays deleted (absent
                    // from get(family)); only its direct read is memoized.
                    const value = resolveAtomDefaultValue(
                        state,
                        data,
                        initializedAtomsSet,
                    )
                    const cached = setValueInData(state, value, data)
                    // Async default: mirror getAtomInitValue and swap the cached
                    // promise for its resolved value once it settles, so later
                    // reads return the value rather than a forever-pending
                    // promise. Stale-guard against a concurrent re-set/re-delete,
                    // and drop the entry on rejection. Propagate with
                    // skipFamilyIndexUpdate so dependent selectors/subscribers see
                    // the resolved value WITHOUT re-registering (resurrecting) the
                    // deleted member in the family index.
                    if (isPromiseLike(cached)) {
                        cached.then(
                            resolvedValue => {
                                if (data.values.get(state) !== cached) return
                                setValueInData(state, resolvedValue, data)
                                propagateAtomUpdate(
                                    [state],
                                    data,
                                    false,
                                    undefined,
                                    undefined,
                                    true,
                                )
                            },
                            () => {
                                if (data.values.get(state) === cached) {
                                    data.values.delete(state)
                                }
                            },
                        )
                    }
                    return cached as Value
                }
            }
        }
        initAtom<Value, Args>(state, data, initializedAtomsSet)
        initializedAtomsSet.add(state)
        return data.values.get(state)
    }
    if (isSelector<Value>(state)) {
        initSelector<Value>(
            state,
            data,
            initializedAtomsSet,
            circularDependencySet,
        )
        return data.values.get(state)
    }
    if (isAtomFamily<Value, Args>(state)) {
        if (data.parent) {
            const closestData = findClosestStoreWithAtomInitialized(state, data)
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

const findClosestStoreWithAtomInitialized = (
    atom: Atom | AtomFamily<any, any>,
    data: StoreData,
): StoreData => {
    if (!data.parent) return data
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
