import { getState } from "./lib/getState"
import { initAtom } from "./lib/initAtom"
import { setAtom } from "./lib/setAtom"
import { subscribe } from "./lib/subscribe"
import { unsubscribe } from "./lib/unsubscribe"
import { transaction } from "./lib/transaction"
import { isAtom } from "./utils/isAtom"
import { isFamily } from "./utils/isFamily"
import { isSelector } from "./utils/isSelector"
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
        subscriptions: new WeakMap(),
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

    const reset = <V>(atom: Atom<V>) => {
        initAtom(atom, data)
    }

    const sub = <V>(
        state: State<V> | Family<V, any>,
        callback: (value: V, oldValue: V) => void,
    ) => {
        let subscription
        if (isFamily(state)) {
            subscription = {
                callback,
                state,
            }
        } else {
            subscription = {
                callback,
            }
        }
        subscribe(state, subscription, data)
        return () => unsubscribe(state, subscription, data)
    }

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
