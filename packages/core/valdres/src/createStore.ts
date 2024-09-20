import { getState } from "./lib/getState"
import { setAtom } from "./lib/setAtom"
import { subscribe } from "./lib/subscribe"
import { transaction } from "./lib/transaction"
import { isAtom } from "./utils/isAtom"
import { isSelector } from "./utils/isSelector"
import { resetAtom } from "./lib/resetAtom"
import type { Atom } from "./types/Atom"
import type { Family } from "./types/Family"
import type { State } from "./types/State"
import type { Store } from "./types/Store"
import type { StoreData } from "./types/StoreData"
import type { GetValue } from "./types/GetValue"

const generateId = () => (Math.random() + 1).toString(36).substring(7)

export const createStore = (id?: string): Store => {
    const data = {
        id: id ?? generateId(),
        values: new WeakMap(),
        expiredValues: new WeakMap(),
        subscriptions: new WeakMap(),
        subscriptionsRequireEqualCheck: new WeakMap(),
        stateConsumers: new WeakMap(),
        stateDependencies: new WeakMap(),
    } as StoreData

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
