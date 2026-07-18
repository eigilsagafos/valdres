import type { GlobalAtom } from "../types/GlobalAtom"
import type { Store } from "../types/Store"
import type { StoreData } from "../types/StoreData"
import { STORE_RUNTIME } from "./storeRuntimeKey"

const DISPOSED = Symbol("valdres.disposedStore")
type Lifecycle = Set<GlobalAtom<any>> | typeof DISPOSED
export const STORE_LIFECYCLE = Symbol("valdres.storeLifecycle")
type LifecycleStore = Store & { [STORE_LIFECYCLE]?: Lifecycle }
type RuntimeData = StoreData & { [STORE_RUNTIME]?: LifecycleStore }

// Lifecycle state lives lazily on the canonical Store facade, not StoreData.
// That keeps the compact StoreData hidden class used by ordinary atom get/set
// paths unchanged. Every public store/scope has a canonical runtime before it
// can touch an atom; the fallback only covers raw internal StoreData callers.
const fallbackLifecycles = new WeakMap<StoreData, Lifecycle>()

const getLifecycle = (data: StoreData): Lifecycle | undefined =>
    (data as RuntimeData)[STORE_RUNTIME]?.[STORE_LIFECYCLE] ??
    fallbackLifecycles.get(data)

const setLifecycle = (data: StoreData, lifecycle: Lifecycle): void => {
    const runtime = (data as RuntimeData)[STORE_RUNTIME]
    if (runtime) {
        runtime[STORE_LIFECYCLE] = lifecycle
        fallbackLifecycles.delete(data)
    } else fallbackLifecycles.set(data, lifecycle)
}

const deleteLifecycle = (data: StoreData): void => {
    const runtime = (data as RuntimeData)[STORE_RUNTIME]
    // Clear the slot without deleting it: deleting a property can put the Store
    // facade into dictionary mode and slow every later method lookup.
    if (runtime) runtime[STORE_LIFECYCLE] = undefined
    fallbackLifecycles.delete(data)
}

export const isStoreDisposed = (data: StoreData): boolean =>
    getLifecycle(data) === DISPOSED

export const markStoreDisposed = (data: StoreData): void => {
    setLifecycle(data, DISPOSED)
}

export const trackTouchedGlobal = (
    data: StoreData,
    atom: GlobalAtom<any>,
): boolean => {
    let touched = getLifecycle(data)
    if (touched === DISPOSED) return false
    if (!touched) {
        touched = new Set()
        setLifecycle(data, touched)
    }
    touched.add(atom)
    return true
}

export const untrackTouchedGlobal = (
    data: StoreData,
    atom: GlobalAtom<any>,
): void => {
    const touched = getLifecycle(data)
    if (!touched || touched === DISPOSED) return
    touched.delete(atom)
    if (touched.size === 0) deleteLifecycle(data)
}

export const getTouchedGlobals = (
    data: StoreData,
): ReadonlySet<GlobalAtom<any>> | undefined => {
    const lifecycle = getLifecycle(data)
    return lifecycle === DISPOSED ? undefined : lifecycle
}
