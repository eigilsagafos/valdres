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
    familyArgs: Args,
    familyArgsStringified: string | boolean | number,
) => {
    if (options.name) {
        return {
            equal,
            ...options,
            name: options?.name + "_" + familyArgsStringified,
            family,
            familyArgs,
            familyArgsStringified,
        }
    } else {
        return { equal, ...options, family, familyArgs, familyArgsStringified }
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
    const atomFamily = (...args: Args) => {
        const argsStringified = stringifyFamilyArgs(args)
        if (map.has(argsStringified)) {
            return map.get(argsStringified)
        }

        const familyAtom = atomFamilyAtom<Value, Args>(
            // @ts-ignore @ts-todo
            handleDefaultValue<Value, Args>(defaultValue, ...args),
            createOptions<Value, Args>(
                options,
                // @ts-ignore @ts-todo
                atomFamily,
                args,
                argsStringified,
            ),
        )
        map.set(argsStringified, familyAtom)
        return familyAtom
    }

    if (options?.name)
        Object.defineProperty(atomFamily, "name", {
            value: options.name,
            writable: false,
        })

    return Object.assign(atomFamily, {
        __valdresAtomFamilyMap: map,
        release: (...args: Args) => map.delete(stringifyFamilyArgs(args)),
        equal,
    }) as AtomFamily<Value, Args>
}
