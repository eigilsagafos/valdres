import equal from "fast-deep-equal/es6"
import { atom } from "../atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { AtomOptions } from "../types/AtomOptions"
import { atomFamilyAtom } from "./atomFamilyAtom"
import { stableStringify } from "./stableStringify"
import { selector } from "../selector"
import type { AtomFamilyDefaultValue } from "../types/AtomFamilyDefaultValue"
import { isSelectorFamily } from "../utils/isSelectorFamily"

const createOptions = <K, V>(
    options: AtomOptions<V> = {},
    family: AtomFamily<K, V>,
    familyKey: K,
    keyStringified: string | boolean | number,
) => {
    if (options.name) {
        return {
            equal,
            ...options,
            name: options?.name + "_" + keyStringified,
            family,
            familyKey,
        }
    } else {
        return { equal, ...options, family, familyKey }
    }
}

const handleDefaultValue = <Key, Value>(
    defaultValue: AtomFamilyDefaultValue<Key, Value>,
    key: Key,
) => {
    if (isSelectorFamily(defaultValue)) return defaultValue(key)
    // @ts-ignore @ts-todo
    if (typeof defaultValue === "function") return () => defaultValue(key)
    return defaultValue
}

export const createAtomFamily = <Key, Value>(
    defaultValue: AtomFamilyDefaultValue<Key, Value>,
    options?: AtomOptions<Value>,
) => {
    const map = new Map()
    const keysAtom = atom(new Set<Key>())
    const atomFamily = Object.assign(
        (key: Key) => {
            const keyStringified = stableStringify(key)
            if (map.has(keyStringified)) {
                return map.get(keyStringified)
            }

            const familyAtom = atomFamilyAtom<Key, Value>(
                // @ts-ignore @ts-todo
                handleDefaultValue<Key, Value>(defaultValue, key),
                createOptions<Key, Value>(
                    options,
                    atomFamily,
                    Object.freeze(key),
                    keyStringified,
                ),
            )
            map.set(keyStringified, familyAtom)
            return familyAtom
        },
        {
            __valdresAtomFamilyMap: map,
            release: (key: Key) => map.delete(key),
            __keysAtom: keysAtom,
            __keysSelector: selector(get => Array.from(get(keysAtom))),
        },
    )
    if (options?.name)
        Object.defineProperty(atomFamily, "name", {
            value: options.name,
            writable: false,
        })
    return atomFamily as AtomFamily<Key, Value>
}
