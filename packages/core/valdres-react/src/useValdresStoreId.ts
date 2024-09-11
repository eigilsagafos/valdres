import { useValdresStore } from "./useValdresStore"

export const useValdresStoreId = (): string => useValdresStore().data.id
