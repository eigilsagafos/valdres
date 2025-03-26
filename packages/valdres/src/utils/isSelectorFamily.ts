import type { SelectorFamily } from "../types/SelectorFamily"

export const isSelectorFamily = <
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    state: any,
): state is SelectorFamily<Value, Args> =>
    state && Object.hasOwn(state, "__valdresSelectorFamilyMap")
