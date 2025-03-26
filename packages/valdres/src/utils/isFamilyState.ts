import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { AtomFamilySelector } from "../types/AtomFamilySelector"

export const isFamilyState = <
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    state: any,
): state is AtomFamilyAtom<Value, Args> | AtomFamilySelector<Value, Args> =>
    state && Object.hasOwn(state, "family")
