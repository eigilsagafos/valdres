import { useContext } from "react"
import { StoreContext } from "./lib/StoreContext"

export const useStoreId = (): string => {
    const [currentStore] = useContext(StoreContext)
    if (!currentStore)
        throw new Error(
            "No valdres store found. Make sure you wrap your code in a <Provider>",
        )

    return currentStore.data.id
}
