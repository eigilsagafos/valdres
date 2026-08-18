import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyDefaultValue } from "../types/AtomFamilyDefaultValue"
import type { AtomFamilyOptions } from "../types/AtomFamilyOptions"
import { createAtomFamily } from "./createAtomFamily"

const atomFamilies = new Map<string, AtomFamily<any, any>>()

export const createGlobalAtomFamily = <
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    defaultValue: AtomFamilyDefaultValue<Value, Args>,
    options: AtomFamilyOptions<Value, Args>,
) => {
    if (!options.name)
        throw new Error("valdres: missing name for global atomFamily")
    if (atomFamilies.has(options.name)) {
        return atomFamilies.get(options.name) as AtomFamily<Value, Args>
    }

    const family = createAtomFamily(defaultValue, options, true)
    atomFamilies.set(options.name, family)
    return family
}
