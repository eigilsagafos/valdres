import type { GetValue } from "./types/GetValue"

export const selector = <V>(
    get: (get: GetValue) => V,
    debugLabel?: string,
) => ({
    get,
    debugLabel,
})
