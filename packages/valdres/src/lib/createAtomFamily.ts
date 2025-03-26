import { atom } from "../atom"
import { selector } from "../selector"
import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyDefaultValue } from "../types/AtomFamilyDefaultValue"
import type { AtomOptions } from "../types/AtomOptions"
import { isSelectorFamily } from "../utils/isSelectorFamily"
import { atomFamilyAtom } from "./atomFamilyAtom"
import { equal } from "./equal"
import { stringifyFamilyArgs } from "./stringifyFamilyArgs"

const createOptions = <
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    options: AtomOptions<Value> = {},
    family: AtomFamily<Value, Args>,
    familyKey: Args,
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

const handleDefaultValue = <Value extends any, Args extends [any, ...any[]]>(
    defaultValue: AtomFamilyDefaultValue<Value, Args>,
    ...args: Args
) => {
    // @ts-ignore @ts-todo
    if (isSelectorFamily(defaultValue)) return defaultValue(...args)
    // @ts-ignore @ts-todo
    if (typeof defaultValue === "function") return () => defaultValue(...args)
    return defaultValue
}

export const createAtomFamily = <
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    defaultValue: AtomFamilyDefaultValue<Value, Args>,
    options?: AtomOptions<Value>,
) => {
    const map = new Map()
    const keysAtom = atom(new Set<Args>())
    const atomFamily = Object.assign(
        (...args: Args) => {
            const keyStringified = stringifyFamilyArgs(...args)
            if (map.has(keyStringified)) {
                return map.get(keyStringified)
            }

            const familyAtom = atomFamilyAtom<Value, Args>(
                // @ts-ignore @ts-todo
                handleDefaultValue<Value, Args>(defaultValue, ...args),
                createOptions<Value, Args>(
                    options,
                    atomFamily,
                    args,
                    keyStringified,
                ),
            )
            map.set(keyStringified, familyAtom)
            return familyAtom
        },
        {
            __valdresAtomFamilyMap: map,
            release: (...args: Args) =>
                map.delete(stringifyFamilyArgs(...args)),
            __keysAtom: keysAtom,
            __keysSelector: selector(get => Array.from(get(keysAtom))),
        },
    )
    if (options?.name)
        Object.defineProperty(atomFamily, "name", {
            value: options.name,
            writable: false,
        })
    return atomFamily as AtomFamily<Value, Args>
}
