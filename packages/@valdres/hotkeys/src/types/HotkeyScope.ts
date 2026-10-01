import type { Selector } from "valdres"

/** A layer of hotkeys, created by `hotkeyScope` and activated per store. */
export type HotkeyScope = Readonly<{
    name: string
    /** Bindings in a higher-priority active scope outrank lower layers. The base layer is 0. */
    priority: number
    /** While active, bindings in lower-priority layers are not eligible at all. */
    exclusive: boolean
    /** Whether the scope is active in the store you read it from. */
    active: Selector<boolean>
}>
