import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyDefaultValue } from "../types/AtomFamilyDefaultValue"
import type { AtomOptions } from "../types/AtomOptions"
import { isSelectorFamily } from "../utils/isSelectorFamily"
import { createAtom } from "./atomShape"
import { equal } from "./equal"
import { familyKey } from "./familyKey"
import { globalAtom } from "./globalAtom"

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
    const isGlobal = !!options?.global

    const atomFamily = (...args: Args) => {
        const key = familyKey(args)
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

        const memberName = hasName
            ? options!.name + "_" + key
            : undefined

        let familyAtom: any
        if (isGlobal) {
            familyAtom = globalAtom(dv, {
                ...options,
                name: memberName,
            })
            familyAtom.family = atomFamily
            familyAtom.familyArgs = args
            familyAtom.familyArgsStringified = key
        } else {
            // Same hidden class as a plain atom — family metadata is wired
            // into the literal so V8 doesn't have to add the fields
            // post-hoc.
            familyAtom = createAtom<Value>(
                dv,
                options,
                memberName,
                atomFamily as any,
                args,
                key,
            )
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
