import { useStore as useStoreValdres, StoreContext } from "valdres-react"
import { getDefaultStore } from "./getDefaultStore"
import { useContext } from "react"

export const useStore = () => {
    const [currentStore, allStores] = useContext(StoreContext)
    if (!currentStore) return getDefaultStore()
    return useStoreValdres()
}
