import { getContext, setContext } from "svelte"
import type { Store } from "valdres"

const VALDRES_CONTEXT_KEY = "valdres-store"

export const setValdresContext = (store: Store): void => {
    setContext(VALDRES_CONTEXT_KEY, store)
}

export const getValdresContext = (): Store => {
    const store = getContext<Store>(VALDRES_CONTEXT_KEY)
    if (!store) throw new Error("No valdres store found in context. Did you call setValdresContext(store) in a parent component?")
    return store
}
