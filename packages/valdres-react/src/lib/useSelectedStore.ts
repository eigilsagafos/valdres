import { useContext } from "react"
import type { Store } from "valdres"
import { assertStore } from "valdres/adapter-internals/v1"
import { StoreContext } from "./StoreContext"

export const useSelectedStore = (explicitStore?: Store): Store => {
    const contextStore = useContext(StoreContext)
    const selectedStore = explicitStore ?? contextStore

    if (selectedStore === undefined) {
        throw new Error(
            "valdres-react: no Store was provided. Pass a Store explicitly or render under <Provider store={store}>.",
        )
    }

    assertStore(selectedStore)
    return selectedStore
}
