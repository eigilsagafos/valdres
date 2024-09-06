import { atom } from "./atom"
import { stableStringify } from "./lib/stableStringify"
import type { AtomFamily } from "./types/AtomFamily"

const handleDefaultValue = (defaultValue, override, key) => {
    if (override) {
        return typeof override === "function"
            ? () =>
                  typeof defaultValue === "function"
                      ? override(defaultValue(key))
                      : override(defaultValue)
            : override
    } else {
        return typeof defaultValue === "function"
            ? () => defaultValue(key)
            : defaultValue
    }
}

export const atomFamily = <Value, Key>(
    defaultValue?: Value | ((arg: Key) => Value | Promise<Value>),
    debugLabel?: string,
): AtomFamily<Value, Key> => {
    const map = new Map()
    const atomFamily = (key: Key, defaultOverride?: Value) => {
        const keyStringified = stableStringify(key)
        if (map.has(keyStringified)) {
            if (defaultOverride)
                throw new Error(
                    "defaultOverride is only allowed first time an atom is initiaizlied",
                )
            return map.get(keyStringified)
        }
        const atomDebugLabel = debugLabel && debugLabel + "_" + keyStringified
        const newAtom = atom<Value, Key>(
            handleDefaultValue(defaultValue, defaultOverride, key),
            atomDebugLabel,
        )
        newAtom.family = atomFamily
        newAtom.familyKey = Object.freeze(key)
        map.set(keyStringified, newAtom)
        return newAtom
    }
    atomFamily._map = map
    return atomFamily
}
