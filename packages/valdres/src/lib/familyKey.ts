import { stringifyFamilyArgs } from "./stringifyFamilyArgs"

export type FamilyKey = string | number | boolean

export const familyKey = (args: readonly unknown[]): FamilyKey => {
    if (args.length === 1) {
        const a = args[0]
        const t = typeof a
        if (t === "string" || t === "number" || t === "boolean")
            return a as FamilyKey
    }
    return stringifyFamilyArgs(args as any[])
}
