import { globalStore } from "../globalStore"
import type { AtomOptions } from "../types/AtomOptions"
import type { FamilyKey } from "../types/FamilyKey"
import type { AtomFamilyDefaultValue } from "../types/AtomFamilyDefaultValue"
import { createAtomFamily } from "./createAtomFamily"
import type { AtomFamily } from "../types/AtomFamily"

export const createGlobalAtomFamily = <Key = FamilyKey, Value = unknown>(
    defaultValue: AtomFamilyDefaultValue<Key, Value>,
    options: AtomOptions<Value>,
) => {
    if (globalStore.atomFamilies.has(options.name)) {
        return globalStore.atomFamilies.get(options.name) as AtomFamily<
            Key,
            Value
        >
    }

    const family = createAtomFamily(defaultValue, options)
    globalStore.atomFamilies.set(options.name, family)
    return family
}
