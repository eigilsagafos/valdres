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
 * const user = atom<string>("Default Value", { label: "userAtom"})
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
    if (!options) return { defaultValue }
    if (options.global) {
        return globalAtom(defaultValue, options)
    }
    return {
        defaultValue,
        ...options,
    } as Atom<V>
}