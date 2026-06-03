import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyDefaultValue } from "../types/AtomFamilyDefaultValue"
import type { AtomOptions } from "../types/AtomOptions"
import { isSelectorFamily } from "../utils/isSelectorFamily"
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

    // Cold path: resolve default, build the atom, cache it. Only runs on a cache
    // miss, so the per-call hot path (cache hit) never pays for any of this.
    const build = (args: any[], key: any) => {
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

        const memberName = hasName ? options!.name + "_" + key : undefined

        let familyAtom: any
        if (isGlobal) {
            familyAtom = globalAtom(dv, {
                ...options,
                name: memberName,
            })
        } else {
            // Build atom in a single allocation — no intermediate objects
            familyAtom = {
                equal,
                ...options,
                defaultValue: dv,
                name: memberName,
            }
        }

        // @ts-ignore @ts-todo
        familyAtom.family = atomFamily
        familyAtom.familyArgs = args
        familyAtom.familyArgsStringified = key

        map.set(key, familyAtom)
        return familyAtom
    }

    // Hot path is the cache hit. Declaring a single positional param and reading
    // only `arguments.length` (never indexing `arguments`) lets JSC skip
    // materializing the arguments object and skip the rest-parameter array
    // allocation that `(...args)` forces on every call. The key for a single
    // primitive arg IS that primitive (see familyKey), so we look it up directly —
    // no cross-module familyKey() call on the hot path either.
    function atomFamily(a0?: any) {
        if (arguments.length === 1) {
            const t = typeof a0
            if (t === "string" || t === "number" || t === "boolean") {
                const cached = map.get(a0)
                if (cached !== undefined) return cached
                return build([a0], a0)
            }
        }
        // Cold/variadic path: object/multi args need a stable stringified key.
        const args = Array.prototype.slice.call(arguments)
        const key = familyKey(args)
        const cached = map.get(key)
        if (cached !== undefined) return cached
        return build(args, key)
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
        // atomFamily uses a single positional param + `arguments` to dodge the
        // rest-array allocation on the hot path; cast through unknown since that
        // shape isn't structurally a (...args: Args) signature.
    }) as unknown as AtomFamily<Value, Args>
}
