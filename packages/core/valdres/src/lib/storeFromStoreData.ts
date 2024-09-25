import { isAtom } from "../utils/isAtom"
import { isSelector } from "../utils/isSelector"
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
        if (isAtom(state)) {
            return setAtom(state, value, data)
        } else {
            if (isSelector(state)) {
                if (state.set) {
                    txn((set, get) => state.set({ get, set }, value))
                    return undefined
                } else {
                    throw new Error("set on selector is not supported")
                }
            }
            throw new Error("Invalid state object passed to set")
        }

        // if (sw new Error("Invalid state object passed to set")
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