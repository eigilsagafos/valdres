import { stableStringify } from "./stableStringify"
import { stringifyFamilyArgs } from "./stringifyFamilyArgs"

export type FamilyKey = string | number | boolean

// Canonicalize the structural key per object identity. Same key string
// stableStringify would produce, but computed once per reference instead
// of on every cache hit. ~70–300× faster for object-keyed families.
const objKeyCache = new WeakMap<object, FamilyKey>()

export const familyKey = (args: readonly unknown[]): FamilyKey => {
    if (args.length === 1) {
        const a = args[0]
        const t = typeof a
        if (t === "string" || t === "number" || t === "boolean")
            return a as FamilyKey
        if (t === "object" && a !== null) {
            const cached = objKeyCache.get(a as object)
            if (cached !== undefined) return cached
            const key = stableStringify(a) as FamilyKey
            objKeyCache.set(a as object, key)
            return key
        }
    }
    return stringifyFamilyArgs(args as any[])
}
