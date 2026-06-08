import { equal } from "./lib/equal"
import { registerNamedAtom } from "./lib/atomRegistry"
import { globalAtom } from "./lib/globalAtom"
import type { Atom } from "./types/Atom"
import type { AtomDefaultValue } from "./types/AtomDefaultValue"
import type { AtomOptions } from "./types/AtomOptions"
import type { GlobalAtom } from "./types/GlobalAtom"

/**
 * [Docs Reference](https://valdres.dev/valdres/api/atom)
 *
 * @example
 *
 * const user = atom<string>("Default Value", { name: "userAtom"})
 *
 */
export function atom<V>(
    defaultValue: AtomDefaultValue<V>,
    options: AtomOptions<V> & { global: true },
): GlobalAtom<V>

export function atom<V>(
    defaultValue?: AtomDefaultValue<V>,
    options?: AtomOptions<V>,
): Atom<V>

export function atom<V>(
    defaultValue?: AtomDefaultValue<V>,
    options?: AtomOptions<V>,
) {
    if (!options) return { equal, defaultValue }
    if (options.global) {
        const globalAtomInstance = globalAtom(defaultValue, options)
        registerNamedAtom(globalAtomInstance)
        return globalAtomInstance
    }
    const atomInstance = {
        equal,
        defaultValue,
        ...options,
    } as Atom<V>
    registerNamedAtom(atomInstance)
    return atomInstance
}
