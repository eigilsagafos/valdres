import { atom } from "./atom"
import { stableStringify } from "./lib/stableStringify"
import { isSelectorFamily } from "./utils/isSelectorFamily"
import type { AtomFamily } from "./types/AtomFamily"
import type { AtomOptions } from "./types/AtomOptions"
import type { Selector } from "./types/Selector"
import type { SelectorFamily } from "./types/SelectorFamily"

type DefaultValueCallback<Key, Value> = (arg: Key) => Value | Promise<Value>

const createOptions = (
    options: AtomOptions,
    key: string | boolean | number,
) => {
    if (options.label) {
        return {
            ...options,
            label: options?.label + "_" + key,
        }
    } else {
        return options
    }
}

const handleDefaultValue = <Value, Key>(
    defaultValue: AtomFamilyDefaultValue<Value, Key>,
    key: Key,
) => {
    if (isSelectorFamily(defaultValue)) return defaultValue(key)
    // @ts-ignore @ts-todo
    if (typeof defaultValue === "function") return () => defaultValue(key)
    return defaultValue
}

type AtomFamilyDefaultValue<Value, Key> =
    | undefined
    | Value
    | DefaultValueCallback<Key, Value>
    | Selector<Value>
    | SelectorFamily<Value, Key>

export const atomFamily = <Value = unknown, Key = unknown>(
    defaultValue?: AtomFamilyDefaultValue<Value, Key>,
    options?: AtomOptions<Value>,
): AtomFamily<Value, Key> => {
    const map = new Map()
    const atomFamily = (key: Key) => {
        const keyStringified = stableStringify(key)
        if (map.has(keyStringified)) {
            return map.get(keyStringified)
        }

        const newAtom = atom<Value, Key>(
            handleDefaultValue<Value, Key>(defaultValue, key),
            options ? createOptions(options, keyStringified) : undefined,
        )
        newAtom.family = atomFamily
        newAtom.familyKey = Object.freeze(key)
        map.set(keyStringified, newAtom)
        return newAtom
    }
    atomFamily.__valdresAtomFamilyMap = map
    if (options?.label) atomFamily.label = options.label
    return atomFamily
}
