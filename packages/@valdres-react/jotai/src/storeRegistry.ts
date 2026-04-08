/**
 * Maps store IDs (data.id) to store instances so that selectors can
 * look up their evaluating store during deferred reads (e.g. setSelf).
 *
 * Uses WeakRef so the registry does not prevent stores (and transitively
 * their atoms/values) from being garbage-collected when nothing else
 * references them. A FinalizationRegistry cleans up stale map entries.
 */
const storeMap = new Map<string, WeakRef<any>>()

const cleanup = new FinalizationRegistry<string>((id) => {
    const ref = storeMap.get(id)
    if (ref && ref.deref() === undefined) {
        storeMap.delete(id)
    }
})

export const registerStore = (id: string, store: any) => {
    storeMap.set(id, new WeakRef(store))
    cleanup.register(store, id)
}

export const unregisterStore = (id: string) => {
    storeMap.delete(id)
}

export const getStoreById = (id: string) => {
    const ref = storeMap.get(id)
    return ref?.deref()
}
