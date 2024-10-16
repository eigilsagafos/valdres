import { useStoreId, useStore as useStoreValdres } from "valdres-react"
import { getDefaultStore } from "./getDefaultStore"

export const useStore = () => {
    const storeId = useStoreId()
    if (!storeId) return getDefaultStore()
    return useStoreValdres()
}
