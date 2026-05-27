import { createAtom } from "./lib/atomShape"
import { equal as defaultEqual } from "./lib/equal"
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
    // No-options atoms keep the minimal 2-field literal — V8's escape
    // analysis on this allocation is what made the pre-refactor `atom(1)`
    // benchmark run at ~2ns. Atoms with options route through createAtom
    // and get the full shape (one hidden class across all option combos).
    // The result is two atom shapes in the wild instead of N, which keeps
    // hot reads polymorphic-but-cached rather than megamorphic.
    if (!options) return { equal: defaultEqual, defaultValue } as Atom<V>
    if (options.global) {
        return globalAtom(defaultValue, options)
    }
    return createAtom<V>(
        defaultValue,
        options,
        options.name,
        undefined,
        undefined,
        undefined,
    )
}
