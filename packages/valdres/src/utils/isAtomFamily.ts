import type { AtomFamily } from "../types/AtomFamily"

export const isAtomFamily = <
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    state: any,
): state is AtomFamily<Value, Args> =>
    state && Object.hasOwn(state, "__valdresAtomFamilyMap")
