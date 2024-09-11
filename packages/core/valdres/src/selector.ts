import type { GetValue } from "./types/GetValue"

export const selector = (get: GetValue, debugLabel?: string) => ({
    get,
    debugLabel,
})
