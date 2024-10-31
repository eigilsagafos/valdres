import type { AtomDefaultValue } from "../types/AtomDefaultValue"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { AtomFamilyGlobalAtom } from "../types/AtomFamilyGlobalAtom"
import type { AtomOptions } from "../types/AtomOptions"
import { globalAtom } from "./globalAtom"

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
        return globalAtom(defaultValue, options) as AtomFamilyGlobalAtom<
            Key,
            Value
        >
    }

    return {
        ...options,
        defaultValue,
    } as AtomFamilyAtom<Key, Value>
}
