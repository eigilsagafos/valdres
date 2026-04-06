import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyDefaultValue } from "../types/AtomFamilyDefaultValue"
import type { AtomOptions } from "../types/AtomOptions"
import { isSelectorFamily } from "../utils/isSelectorFamily"
import { equal } from "./equal"
import { stringifyFamilyArgs } from "./stringifyFamilyArgs"

const familyKey = (args: any[]) => {
    if (args.length === 1) {
        const a = args[0]
        const t = typeof a
        if (t === "string" || t === "number" || t === "boolean") return a
    }
    return stringifyFamilyArgs(args)
}

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
        // Inline key computation — keep hot path in one function for JIT
        const key =
            args.length === 1 &&
            (typeof args[0] === "string" ||
                typeof args[0] === "number" ||
                typeof args[0] === "boolean")
                ? args[0]
                : stringifyFamilyArgs(args)
        const cached = map.get(key)
        if (cached !== undefined) return cached

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
            familyArgsStringified: key,
            name: hasName
                ? options!.name + "_" + key
                : undefined,
        }

        map.set(key, familyAtom)
        return familyAtom
    }

    if (hasName)
        Object.defineProperty(atomFamily, "name", {
            value: options!.name,
            writable: false,
        })

    return Object.assign(atomFamily, {
        __valdresAtomFamilyMap: map,
        release: (...args: Args) => map.delete(familyKey(args)),
        equal,
    }) as AtomFamily<Value, Args>
}
