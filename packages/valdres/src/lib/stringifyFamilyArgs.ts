import { stableStringify } from "./stableStringify"

export const stringifyFamilyArgs = (...args: any[]) => {
    return args.length === 1 ? stableStringify(args[0]) : stableStringify(args)
}
