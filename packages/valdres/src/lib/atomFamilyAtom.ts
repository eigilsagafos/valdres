import type { AtomDefaultValue } from "../types/AtomDefaultValue"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { AtomFamilyGlobalAtom } from "../types/AtomFamilyGlobalAtom"
import type { AtomOptions } from "../types/AtomOptions"

export function atomFamilyAtom<Key, Value>(
    defaultValue: AtomDefaultValue<Value>,
    options: AtomOptions<Value> & { global: true },
): AtomFamilyGlobalAtom<Key, Value>

export function atomFamilyAtom<Key, Value>(
    defaultValue: AtomDefaultValue<Value>,
    options: AtomOptions<Value>,
): AtomFamilyAtom<Key, Value>

export function atomFamilyAtom<Key, Value>(
    defaultValue: AtomDefaultValue<Value>,
    options: AtomOptions<Value>,
) {
    if (options.global) {
        return {
            ...options,
            defaultValue,
        } as AtomFamilyGlobalAtom<Key, Value>
    }

    return {
        ...options,
        defaultValue,
    } as AtomFamilyAtom<Key, Value>
}
