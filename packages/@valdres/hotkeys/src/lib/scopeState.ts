import { atom, type Atom, type Store } from "valdres"
import type { HotkeyScope } from "../types/HotkeyScope"

/**
 * Each scope's activation count, one atom per Store object. A child scope
 * Store inherits its parent's atom values, so one atom per scope would make an
 * activation in a root visible in every child; an atom per Store keeps
 * activation strictly per Store object without any core support.
 */
const counts = new WeakMap<HotkeyScope, WeakMap<Store, Atom<number>>>()

export const registerScope = (scope: HotkeyScope): void => {
    counts.set(scope, new WeakMap())
}

export const isHotkeyScope = (value: unknown): value is HotkeyScope =>
    typeof value === "object" &&
    value !== null &&
    counts.has(value as HotkeyScope)

/** The atom counting `scope`'s activations in exactly `store`. */
export const scopeCountAtom = (
    scope: HotkeyScope,
    store: Store,
): Atom<number> => {
    const perStore = counts.get(scope)
    if (perStore === undefined)
        throw new TypeError("Not a scope from hotkeyScope()")
    let count = perStore.get(store)
    if (count === undefined) {
        count = atom(0, { name: `@valdres/hotkeys/scope/${scope.name}/count` })
        perStore.set(store, count)
    }
    return count
}
