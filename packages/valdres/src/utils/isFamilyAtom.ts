import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import { isAtom } from "./isAtom"
import { isFamilyState } from "./isFamilyState"

export const isFamilyAtom = <
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    state: any,
): state is AtomFamilyAtom<Value, Args> => isFamilyState(state) && isAtom(state)
