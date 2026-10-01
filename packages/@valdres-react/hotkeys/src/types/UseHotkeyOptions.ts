import type { HotkeyOptions } from "@valdres/hotkeys"
import type { Store } from "valdres"

export type UseHotkeyOptions = HotkeyOptions & {
    /** Use this Store instead of the nearest `<Provider>`'s. */
    readonly store?: Store
}
