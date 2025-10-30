import type { Atom } from "../types/Atom"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { Family } from "../types/Family"
import type { GetValue } from "../types/GetValue"
import type { SetAtom } from "../types/SetAtom"
import type { State } from "../types/State"
import type { ScopedStore, ScopeFn, Store } from "../types/Store"
import type { ScopedStoreData, StoreData } from "../types/StoreData"
import type { TransactionFn } from "../types/TransactionFn"
import { isAtom } from "../utils/isAtom"
import { isSelector } from "../utils/isSelector"
import { createStoreData } from "./createStoreData"
import { deleteFamilyAtom } from "./deleteFamilyAtom"
import { getState } from "./getState"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"
import { resetAtom } from "./resetAtom"
import { setAtom } from "./setAtom"
import { subscribe } from "./subscribe"
import { transaction } from "./transaction"

const SelectorProvidedToSetError = `Invalid state object passed to set().
You provided a \`selector\`.
Only \`atom\` cam be set.
`
const InvalidStateSetError = `Invalid state object passed to set().
Only \`atom\` can be set.
`

export function storeFromStoreData(
    data: ScopedStoreData,
    detach: () => void,
): ScopedStore
export function storeFromStoreData(data: StoreData): Store
export function storeFromStoreData(
    data: ScopedStoreData | StoreData,
    detach?: () => void,
) {
    const get: GetValue = (state: State) => {
        const set = new Set<Atom>()
        const res = getState(state, data, set)
        if (set.size) {
            propagateUpdatedAtoms([...set], data)
        }
        return res
    }

    // @ts-ignore @ts-todo
    const set: SetAtom = (state, value) => {
        if (isAtom(state)) return setAtom(state, value, data)
        if (isSelector(state)) throw new Error(SelectorProvidedToSetError)
        throw new Error(InvalidStateSetError)
    }

    const reset = <V>(atom: Atom<V>) => resetAtom(atom, data)

    const del = <
        Value extends unknown,
        Args extends [any, ...any[]] = [any, ...any[]],
    >(
        atom: AtomFamilyAtom<Value, Args>,
    ) => deleteFamilyAtom(atom, data)

    const sub = <V>(
        state: State<V> | Family<V, any>,
        callback: () => void,
        deepEqualCheckBeforeCallback: boolean = true,
    ) => subscribe(state, callback, deepEqualCheckBeforeCallback, data)

    const txn = (callback: TransactionFn) => transaction(callback, data)

    const scope: ScopeFn = ((scopeId: string, callback?: any) => {
        if (callback) {
            if (!(scopeId in data.scopes)) {
                throw new Error(`Scope ${scopeId} does not exist`)
            }
            const scopedStoreData = data.scopes[scopeId]
            const scopedStore = storeFromStoreData(
                scopedStoreData,
            ) as ScopedStore
            const res = callback(scopedStore)
            return res
        } else {
            let scopedStoreData
            if (scopeId in data.scopes) {
                scopedStoreData = data.scopes[scopeId]
            } else {
                scopedStoreData = createStoreData(scopeId, data)
                data.scopes[scopeId] = scopedStoreData
            }
            const detach = (expectedToDestory = false) => {
                scopedStoreData.scopeConsumers.delete(detach)
                if (scopedStoreData.scopeConsumers.size === 0) {
                    if (expectedToDestory) {
                        console.log("Deleting scope", scopeId)
                    }
                    delete data.scopes[scopeId]
                    return true
                }
                if (expectedToDestory) {
                    console.warn(
                        `Scope ${scopeId} still has ${scopedStoreData.scopeConsumers.size} consumers, will not detach`,
                    )
                }
                return false
            }

            scopedStoreData.scopeConsumers.add(detach)
            const newStore = storeFromStoreData(data.scopes[scopeId], detach)
            return newStore
        }
    }) as ScopeFn

    if (detach) {
        return {
            get,
            set,
            sub,
            txn,
            reset,
            del,
            data,
            scope,
            detach,
        } as ScopedStore
    } else {
        return {
            get,
            set,
            sub,
            txn,
            reset,
            del,
            data,
            scope,
        } as Store
    }
}
