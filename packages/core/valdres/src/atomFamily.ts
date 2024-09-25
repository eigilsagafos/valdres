import { atom } from "./atom"
import { stableStringify } from "./lib/stableStringify"
import type { AtomFamily } from "./types/AtomFamily"

type DefaultValueCallback<Key, Value> = (arg: Key) => Value | Promise<Value>

export const atomFamily = <Value, Key>(
    defaultValue?: Value | DefaultValueCallback<Key, Value>,
    debugLabel?: string,
): AtomFamily<Value, Key> => {
    const map = new Map()
    const atomFamily = (key: Key, defaultOverride?: Value) => {
        const keyStringified = stableStringify(key)
        if (map.has(keyStringified)) {
            return map.get(keyStringified)
        }
        const atomDebugLabel = debugLabel && debugLabel + "_" + keyStringified
        const newAtom = atom<Value, Key>(
            typeof defaultValue === "function"
                ? // @ts-ignore
                  () => defaultValue(key)
                : defaultValue,
            {
                label: atomDebugLabel,
            },
        )
        newAtom.family = atomFamily
        newAtom.familyKey = Object.freeze(key)
        map.set(keyStringified, newAtom)
        // updateSelectorSubscribers(atomFamily, )
        return newAtom
    }
    atomFamily._map = map
    return atomFamily
}
