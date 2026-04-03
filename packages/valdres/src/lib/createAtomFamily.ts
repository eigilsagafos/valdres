import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyDefaultValue } from "../types/AtomFamilyDefaultValue"
import type { AtomOptions } from "../types/AtomOptions"
import { isSelectorFamily } from "../utils/isSelectorFamily"
import { equal } from "./equal"
import { stringifyFamilyArgs } from "./stringifyFamilyArgs"

export const createAtomFamily = <
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    defaultValue: AtomFamilyDefaultValue<Value, Args>,
    options?: AtomOptions<Value>,
) => {
    const map = new Map()
    // Hoist type checks to family creation time — avoid per-call overhead
    const isSelectorFamilyDefault = isSelectorFamily(defaultValue)
    const isFunctionDefault =
        !isSelectorFamilyDefault && typeof defaultValue === "function"
    const hasName = !!options?.name

    const atomFamily = (...args: Args) => {
        const argsStringified = stringifyFamilyArgs(args)
        if (map.has(argsStringified)) {
            return map.get(argsStringified)
        }

        // Resolve default value — inlined to avoid intermediate closures
        let dv: any
        if (isSelectorFamilyDefault) {
            // @ts-ignore @ts-todo
            dv = defaultValue(...args)
        } else if (isFunctionDefault) {
            // @ts-ignore @ts-todo
            dv = () => defaultValue(...args)
        } else {
            dv = defaultValue
        }

        // Build atom in a single allocation — no intermediate objects
        const familyAtom = {
            equal,
            ...options,
            defaultValue: dv,
            // @ts-ignore @ts-todo
            family: atomFamily,
            familyArgs: args,
            familyArgsStringified: argsStringified,
            name: hasName
                ? options!.name + "_" + argsStringified
                : undefined,
        }

        map.set(argsStringified, familyAtom)
        return familyAtom
    }

    if (hasName)
        Object.defineProperty(atomFamily, "name", {
            value: options!.name,
            writable: false,
        })

    return Object.assign(atomFamily, {
        __valdresAtomFamilyMap: map,
        release: (...args: Args) => map.delete(stringifyFamilyArgs(args)),
        equal,
    }) as AtomFamily<Value, Args>
}
