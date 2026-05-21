import type { Options } from "@valdres/hotkeys"

export type HookRestArgs =
    | []
    | [any[]]
    | [Partial<Options>]
    | [Partial<Options>, any[]]
