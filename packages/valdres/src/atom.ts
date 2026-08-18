import { equal } from "./lib/equal"
import { registerName } from "./lib/registerName"
import type { Atom } from "./types/Atom"
import type { AtomDefaultValue } from "./types/AtomDefaultValue"
import type { AtomOptions } from "./types/AtomOptions"

/**
 * [Docs Reference](https://valdres.dev/valdres/api/atom)
 *
 * @example
 *
 * const user = atom<string>("Default Value", { name: "userAtom"})
 *
 */
export function atom<V>(
    defaultValue?: AtomDefaultValue<V>,
    options?: AtomOptions<V>,
): Atom<V> {
    if (!options) return { equal, defaultValue }
    const created = {
        equal,
        defaultValue,
        ...options,
    } as Atom<V>
    if (options.name !== undefined) registerName(options.name, created)
    return created
}
