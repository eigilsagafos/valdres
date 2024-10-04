import { atom } from "./atom"
import { stableStringify } from "./lib/stableStringify"
import type { AtomFamily } from "./types/AtomFamily"
import type { AtomOptions } from "./types/AtomOptions"

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

export const atomFamily = <Value = unknown, Key = unknown>(
    defaultValue?: Value | DefaultValueCallback<Key, Value>,
    options?: AtomOptions<Value>,
): AtomFamily<Value, Key> => {
    const map = new Map()
    const atomFamily = (key: Key) => {
        const keyStringified = stableStringify(key)
        if (map.has(keyStringified)) {
            return map.get(keyStringified)
        }

        const newAtom = atom<Value, Key>(
            typeof defaultValue === "function"
                ? // @ts-ignore
                  () => defaultValue(key)
                : defaultValue,
            options ? createOptions(options, keyStringified) : undefined,
        )
        newAtom.family = atomFamily
        newAtom.familyKey = Object.freeze(key)
        map.set(keyStringified, newAtom)
        return newAtom
    }
    atomFamily._map = map
    if (options?.label) atomFamily.label = options.label
    return atomFamily
}
