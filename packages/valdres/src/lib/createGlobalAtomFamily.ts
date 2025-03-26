import { globalStore } from "../globalStore"
import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyDefaultValue } from "../types/AtomFamilyDefaultValue"
import type { AtomOptions } from "../types/AtomOptions"
import { createAtomFamily } from "./createAtomFamily"

export const createGlobalAtomFamily = <
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    defaultValue: AtomFamilyDefaultValue<Value, Args>,
    options: AtomOptions<Value>,
) => {
    if (!options.name) throw new Error(`Missing name for global atomFamiliy`)
    if (globalStore.atomFamilies.has(options.name)) {
        return globalStore.atomFamilies.get(options.name) as AtomFamily<
            Value,
            Args
        >
    }

    const family = createAtomFamily(defaultValue, options)
    globalStore.atomFamilies.set(options.name, family)
    return family
}
