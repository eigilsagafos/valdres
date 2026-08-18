import { createAtomFamily } from "./lib/createAtomFamily"
import type { AtomFamily } from "./types/AtomFamily"
import type { AtomFamilyDefaultValue } from "./types/AtomFamilyDefaultValue"
import type { AtomFamilyOptions } from "./types/AtomFamilyOptions"

export function atomFamily<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    defaultValue?: AtomFamilyDefaultValue<Value, Args>,
    options?: AtomFamilyOptions<Value, Args>,
): AtomFamily<Value, Args> {
    return createAtomFamily(defaultValue, options)
}
