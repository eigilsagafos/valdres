import type { AtomDefaultValue } from "../types/AtomDefaultValue"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { AtomFamilyGlobalAtom } from "../types/AtomFamilyGlobalAtom"
import type { AtomOptions } from "../types/AtomOptions"

export function atomFamilyAtom<V, K>(
    defaultValue: AtomDefaultValue<V>,
    options: AtomOptions<V> & { global: true },
): AtomFamilyGlobalAtom<V, K>

export function atomFamilyAtom<V, K>(
    defaultValue: AtomDefaultValue<V>,
    options: AtomOptions<V>,
): AtomFamilyAtom<V, K>

export function atomFamilyAtom<V, K>(
    defaultValue: AtomDefaultValue<V>,
    options: AtomOptions<V>,
) {
    if (options.global) {
        return {
            ...options,
            defaultValue,
        } as AtomFamilyGlobalAtom<V, K>
    }

    return {
        ...options,
        defaultValue,
    } as AtomFamilyAtom<V, K>
}
