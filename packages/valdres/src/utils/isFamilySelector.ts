import type { AtomFamilySelector } from "../types/AtomFamilySelector"
import { isFamilyState } from "./isFamilyState"
import { isSelector } from "./isSelector"

export const isFamilySelector = <
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    state: any,
): state is AtomFamilySelector<Value, Args> =>
    isFamilyState(state) && isSelector(state)
