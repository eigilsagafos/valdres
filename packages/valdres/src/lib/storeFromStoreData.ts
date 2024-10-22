import type { Atom } from "../types/Atom"
import type { Family } from "../types/Family"
import type { GetValue } from "../types/GetValue"
import type { SetAtom } from "../types/SetAtom"
import type { State } from "../types/State"
import type { Store } from "../types/Store"
import type { StoreData } from "../types/StoreData"
import type { TransactionFn } from "../types/TransactionFn"
import { isAtom } from "../utils/isAtom"
import { isSelector } from "../utils/isSelector"
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

export const storeFromStoreData = (data: StoreData) => {
    const get: GetValue = (state: State, scopeId?: string) =>
        getState(state, data, scopeId)

    const set: SetAtom = (state, value, scopeId?: string) => {
        if (isAtom(state)) return setAtom(state, value, data, scopeId)
        if (isSelector(state)) throw new Error(SelectorProvidedToSetError)
        throw new Error(InvalidStateSetError)
    }

    const reset = <V>(atom: Atom<V>) => resetAtom(atom, data)

    const sub = <V>(
        state: State<V> | Family<V, any>,
        callback: (value: V, oldValue: V) => void,
        deepEqualCheckBeforeCallback: boolean = true,
    ) => subscribe(state, callback, deepEqualCheckBeforeCallback, data)

    const txn = (callback: TransactionFn) => transaction(callback, data)

    return {
        get,
        set,
        sub,
        txn,
        reset,
        data,
        scope: (scopeId: string, callback) => {
            callback({
                get: (state: State) => get(state, scopeId),
                set: <V>(atom: Atom<V>, value: V) => set(atom, value, scopeId),
                data: data.scopes[scopeId],
                sub: () => {
                    throw new Error("TODO")
                },
                reset: () => {
                    throw new Error("TODO")
                },
                txn: () => {
                    throw new Error("TODO")
                },
                scope: () => {
                    throw new Error("TODO")
                },
            })
        },
    } as Store
}
