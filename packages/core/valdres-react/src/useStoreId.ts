import { useStore } from "./useStore"

export const useStoreId = (): string => useStore().data.id
