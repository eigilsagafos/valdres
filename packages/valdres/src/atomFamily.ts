import { atom } from "./atom"
import { atomFamilyAtom } from "./lib/atomFamilyAtom"
import { stableStringify } from "./lib/stableStringify"
import { selector } from "./selector"
import type { AtomFamily } from "./types/AtomFamily"
import type { AtomOptions } from "./types/AtomOptions"
import type { FamilyKey } from "./types/FamilyKey"
import type { Selector } from "./types/Selector"
import type { SelectorFamily } from "./types/SelectorFamily"
import { isSelectorFamily } from "./utils/isSelectorFamily"

const createOptions = <K, V>(
    options: AtomOptions<V> = {},
    family: AtomFamily<K, V>,
    familyKey: K,
    keyStringified: string | boolean | number,
) => {
    if (options.label) {
        return {
            ...options,
            label: options?.label + "_" + keyStringified,
            family,
            familyKey,
        }
    } else {
        return { ...options, family, familyKey }
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

type DefaultValueCallback<Key, Value> = (arg: Key) => Value | Promise<Value>

type AtomFamilyDefaultValue<Key, Value> =
    | undefined
    | Value
    | DefaultValueCallback<Key, Value>
    | Selector<Value>
    | SelectorFamily<Value, Key>

/** [Docs Reference](https://valdres.dev/valdres/api/atomFamily) */
// Object.fromEntries()

// PropertyKey

export function atomFamily<Key = FamilyKey, Value = unknown>(
    defaultValue?: AtomFamilyDefaultValue<Key, Value>,
    options?: AtomOptions<Value>,
) {
    const map = new Map()

    const atomFamily = (key: Key) => {
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
    }
    atomFamily.__valdresAtomFamilyMap = map
    atomFamily.release = (key: Key) => map.delete(key)
    const keysAtom = atom(new Set<Key>())
    atomFamily.__keysAtom = keysAtom
    atomFamily.__keysSelector = selector(get => Array.from(get(keysAtom)))
    if (options?.label) atomFamily.label = options.label
    return atomFamily as AtomFamily<Key, Value>
}
