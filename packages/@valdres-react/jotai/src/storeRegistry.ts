/**
 * Maps store IDs (data.id) to store instances so that selectors can
 * look up their evaluating store during deferred reads (e.g. setSelf).
 *
 * Stores are long-lived (typically app-lifetime), so a Map keyed by
 * string is acceptable here.
 */
const storeMap = new Map<string, any>()

export const registerStore = (id: string, store: any) => {
    storeMap.set(id, store)
}

export const unregisterStore = (id: string) => {
    storeMap.delete(id)
}

export const getStoreById = (id: string) => {
    return storeMap.get(id)
}
