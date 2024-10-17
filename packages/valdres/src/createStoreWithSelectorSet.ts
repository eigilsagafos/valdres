import { createStoreData } from "./lib/createStoreData"
import { setAtom } from "./lib/setAtom"
import { storeFromStoreData } from "./lib/storeFromStoreData"
import { isAtom } from "./utils/isAtom"
import { isSelector } from "./utils/isSelector"
import type { State } from "./types/State"
import type { Store } from "./types/Store"
import type { Selector } from "./types/Selector"

const setSelector = <V>(selector: Selector<V>, values: any[], store: Store) => {
    // @ts-ignore
    return selector.set(store.set, store.get, store.reset, ...values)
}

export const createStoreWithSelectorSet = (id?: string): Store => {
    const data = createStoreData(id)
    const store = storeFromStoreData(data)
    store.set = <V>(state: State<V>, value: V, ...rest: any[]) => {
        if (isAtom(state)) return setAtom(state, value, data)
        if (isSelector(state))
            return setSelector(state, [value, ...rest], store)
        throw new Error("Invalid state object")
    }
    // @ts-ignore
    store.kind = "storeWithSelectorSet"
    return store
}
