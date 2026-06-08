import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { StoreData } from "../types/StoreData"

/** An atom-shaped thing that can appear in a propagation batch. */
export type ChangedAtom =
    | Atom<any>
    | AtomFamilyAtom<any, any>
    | AtomFamily<any, any>

/**
 * Called after every committed write in a store (and its scopes). `data` is
 * the store the change happened in — read `data.values.get(atom)` for the new
 * value, and walk `data.parent` to derive a scope path. `isInitOnly` is true
 * when the batch is purely a lazy first-read initialization, not a `set`.
 */
export type StoreChangeListener = (
    atoms: ChangedAtom[],
    data: StoreData,
    isInitOnly: boolean,
) => void

const registry = new WeakMap<StoreData, Set<StoreChangeListener>>()

/**
 * Hot-path guard. `propagateAtomUpdate` checks `_devListenerState.count > 0`
 * (a single monomorphic property read on a module singleton) before doing any
 * WeakMap work, so stores with no listeners attached pay essentially nothing.
 * Kept as an object property rather than an exported `let` so the read site
 * stays a stable shape across engines.
 */
export const _devListenerState = { count: 0 }

export const addStoreChangeListener = (
    data: StoreData,
    listener: StoreChangeListener,
): (() => void) => {
    let set = registry.get(data)
    if (!set) {
        set = new Set()
        registry.set(data, set)
    }
    set.add(listener)
    _devListenerState.count++
    return () => {
        if (set!.delete(listener)) {
            _devListenerState.count--
            if (set!.size === 0) registry.delete(data)
        }
    }
}

/**
 * Notify listeners for `data`, or — when `data` is a scope with no listeners
 * of its own — the nearest ancestor that has them. The original `data` is
 * passed through so a root listener can tell which scope changed. Only ever
 * called when at least one listener exists, so the parent walk is off the
 * production hot path.
 */
export const notifyStoreChangeListeners = (
    atoms: ChangedAtom[],
    data: StoreData,
    isInitOnly: boolean,
): void => {
    let cur: StoreData | undefined = data
    while (cur) {
        const set = registry.get(cur)
        if (set) {
            for (const listener of set) listener(atoms, data, isInitOnly)
            return
        }
        cur = cur.parent
    }
}
