import { createAtomFamily } from "./lib/createAtomFamily"
import { createGlobalAtomFamily } from "./lib/createGlobalAtomFamily"
import type { AtomFamilyDefaultValue } from "./types/AtomFamilyDefaultValue"
import type { AtomOptions } from "./types/AtomOptions"

export function atomFamily<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    defaultValue?: AtomFamilyDefaultValue<Value, Args>,
    options?: AtomOptions<Value>,
) {
    if (options?.global) return createGlobalAtomFamily(defaultValue, options)
    return createAtomFamily(defaultValue, options)
}
