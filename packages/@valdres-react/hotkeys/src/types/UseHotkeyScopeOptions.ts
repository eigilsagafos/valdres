import type { Store } from "valdres"

export type UseHotkeyScopeOptions = {
    /** Use this Store instead of the nearest `<Provider>`'s. */
    readonly store?: Store
    /** Hold the activation only while true. Default `true`. */
    readonly active?: boolean
}
