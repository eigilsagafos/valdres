import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { AtomFamilySelector } from "../types/AtomFamilySelector"

// `family` is now declared on every atom and selector (initialized to
// undefined) so they share a stable hidden class. Family members get a
// non-undefined `family` set in the constructor — detect by value rather
// than `Object.hasOwn`.
export const isFamilyState = <
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    state: any,
): state is AtomFamilyAtom<Value, Args> | AtomFamilySelector<Value, Args> =>
    !!(state && state.family)
