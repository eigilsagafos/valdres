import { useContext } from "react"
import { StoreContext } from "./lib/StoreContext"

export const useStoreId = (): string => {
    const [currentId] = useContext(StoreContext)
    return currentId
}
