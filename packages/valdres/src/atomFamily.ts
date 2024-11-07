import { createAtomFamily } from "./lib/createAtomFamily"
import { createGlobalAtomFamily } from "./lib/createGlobalAtomFamily"
import type { AtomOptions } from "./types/AtomOptions"
import type { FamilyKey } from "./types/FamilyKey"
import type { AtomFamilyDefaultValue } from "./types/AtomFamilyDefaultValue"

export function atomFamily<Key = FamilyKey, Value = unknown>(
    defaultValue?: AtomFamilyDefaultValue<Key, Value>,
    options?: AtomOptions<Value>,
) {
    if (options?.global) return createGlobalAtomFamily(defaultValue, options)
    return createAtomFamily(defaultValue, options)
}
