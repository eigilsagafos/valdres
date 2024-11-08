import type { Options } from "./types/Options"

export const DEFAULT_OPTIONS: Options = Object.freeze({
    keyup: false,
    keydown: true,
    enabled: true,
    enableOnFormTags: false,
    enableOnContentEditable: false,
    preventDefault: false,
    repeat: false,
})
