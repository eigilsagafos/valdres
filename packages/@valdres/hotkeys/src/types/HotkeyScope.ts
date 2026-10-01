/**
 * A layer of hotkeys, created by `hotkeyScope`. Inactive until activated, and
 * activation is per Store object: activating it in one Store, including a
 * parent scope Store, never activates it in another.
 */
export type HotkeyScope = Readonly<{
    name: string
    /** Bindings in a higher-priority active scope outrank lower layers. The base layer is 0. */
    priority: number
    /** While active, bindings in lower-priority layers are not eligible at all. */
    exclusive: boolean
}>
