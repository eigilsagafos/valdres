import { isAtom } from "../utils/isAtom"
import { getState } from "./getState"
import { resetAtom } from "./resetAtom"
import { setAtom } from "./setAtom"
import { subscribe } from "./subscribe"
import { transaction } from "./transaction"
import type { Atom } from "jotai"
import type { Family } from "../types/Family"
import type { GetValue } from "../types/GetValue"
import type { State } from "../types/State"
import type { Store } from "../types/Store"
import type { StoreData } from "../types/StoreData"

export const storeFromStoreData = (data: StoreData): Store => {
    const get: GetValue = state => getState(state, data)

    const set = <V>(state: Atom<V>, value: V) => {
        if (!isAtom(state)) throw new Error("Invalid state object")
        return setAtom(state, value, data)
    }

    const reset = <V>(atom: Atom<V>) => resetAtom(atom, data)

    const sub = <V>(
        state: State<V> | Family<V, any>,
        callback: (value: V, oldValue: V) => void,
        deepEqualCheckBeforeCallback: boolean = true,
    ) => subscribe(state, callback, deepEqualCheckBeforeCallback, data)

    const txn = callback => transaction(callback, data)

    return {
        get,
        set,
        sub,
        txn,
        reset,
        data,
    }
}
