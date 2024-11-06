import { DEFAULT_OPTIONS, type Options } from "@valdres/hotkeys"
import type { HookRestArgs } from "../types/HookRestArgs"

export const parseHookRestArgs = (args: HookRestArgs): [Options, any[]] => {
    if (args.length === 0) return [DEFAULT_OPTIONS, []]
    if (args.length === 2) return args
    if (args.length === 1) {
        const [arg] = args
        if (Array.isArray(arg)) {
            return [DEFAULT_OPTIONS, arg]
        } else {
            return [{ ...DEFAULT_OPTIONS, ...arg }, []]
        }
    }
    throw new Error("Unsupported")
}
