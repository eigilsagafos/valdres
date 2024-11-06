import type { Atom } from "../types/Atom"
import type { Family } from "../types/Family"
import type { GetValue } from "../types/GetValue"
import type { SetAtom } from "../types/SetAtom"
import type { State } from "../types/State"
import type { ScopedStore, Store } from "../types/Store"
import type { ScopedStoreData, StoreData } from "../types/StoreData"
import type { TransactionFn } from "../types/TransactionFn"
import { isAtom } from "../utils/isAtom"
import { isSelector } from "../utils/isSelector"
import { createStoreData } from "./createStoreData"
import { getState } from "./getState"
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
    // @ts-ignore @ts-todo
    const get: GetValue = (state: State) => getState(state, data)

    const set: SetAtom = (state, value) => {
        if (isAtom(state)) return setAtom(state, value, data)
        if (isSelector(state)) throw new Error(SelectorProvidedToSetError)
        throw new Error(InvalidStateSetError)
    }

    const reset = <V>(atom: Atom<V>) => resetAtom(atom, data)

    const sub = <V>(
        state: State<V> | Family<V, any>,
        callback: () => void,
        deepEqualCheckBeforeCallback: boolean = true,
    ) => subscribe(state, callback, deepEqualCheckBeforeCallback, data)

    const txn = (callback: TransactionFn) => transaction(callback, data)
    const scope = (scopeId: string) => {
        let scopedStoreData
        if (scopeId in data.scopes) {
            scopedStoreData = data.scopes[scopeId]
        } else {
            scopedStoreData = createStoreData(scopeId, data)
            data.scopes[scopeId] = scopedStoreData
        }
        const detach = () => {
            scopedStoreData.scopeConsumers.delete(detach)
            if (scopedStoreData.scopeConsumers.size === 0) {
                delete data.scopes[scopeId]
            }
        }

        scopedStoreData.scopeConsumers.add(detach)
        const newStore = storeFromStoreData(data.scopes[scopeId], detach)
        return newStore
    }

    if (detach) {
        return {
            get,
            set,
            sub,
            txn,
            reset,
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
            data,
            scope,
        } as Store
    }
}
