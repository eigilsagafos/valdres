import { stringifyFamilyArgs } from "./stringifyFamilyArgs"

export const familyKey = (args: any[]) => {
    if (args.length === 1) {
        const a = args[0]
        const t = typeof a
        if (t === "string" || t === "number" || t === "boolean") return a
    }
    return stringifyFamilyArgs(args)
}
