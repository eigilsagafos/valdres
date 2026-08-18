import { globalAtom as createGlobalAtom } from "./lib/globalAtom"
import { registerName } from "./lib/registerName"
import type { AtomDefaultValue } from "./types/AtomDefaultValue"
import type { GlobalAtom } from "./types/GlobalAtom"
import type { GlobalAtomOptions } from "./types/GlobalAtomOptions"

/**
 * [Docs Reference](https://valdres.dev/valdres/api/globalAtom)
 *
 * A cross-store singleton atom: every store that touches it shares the same
 * value and stays in sync. `options.name` is required — it is the atom's
 * global address.
 *
 * @example
 *
 * const online = globalAtom<boolean>(true, { name: "online" })
 *
 */
export function globalAtom<Value = unknown>(
    defaultValue: AtomDefaultValue<Value>,
    options: GlobalAtomOptions<Value>,
): GlobalAtom<Value> {
    if (!options.name) throw new Error("valdres: missing name for global atom")
    const created = createGlobalAtom(defaultValue, options)
    registerName(options.name, created)
    return created
}
