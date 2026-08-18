import { createGlobalAtomFamily } from "./lib/createGlobalAtomFamily"
import type { AtomFamilyDefaultValue } from "./types/AtomFamilyDefaultValue"
import type { GlobalAtomFamily } from "./types/GlobalAtomFamily"
import type { GlobalAtomFamilyOptions } from "./types/GlobalAtomFamilyOptions"

/**
 * [Docs Reference](https://valdres.dev/valdres/api/globalAtomFamily)
 *
 * A cross-store singleton atom family: every store that touches a member
 * shares the same value and stays in sync. `options.name` is required — it
 * is the family's global address, and re-defining the same name returns the
 * existing family.
 *
 * @example
 *
 * const itemById = globalAtomFamily<Item | null, [string]>(null, { name: "itemById" })
 *
 */
export function globalAtomFamily<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    defaultValue: AtomFamilyDefaultValue<Value, Args> | undefined,
    options: GlobalAtomFamilyOptions<Value, Args>,
): GlobalAtomFamily<Value, Args> {
    return createGlobalAtomFamily(
        defaultValue,
        options,
    ) as GlobalAtomFamily<Value, Args>
}
