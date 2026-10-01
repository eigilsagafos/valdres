import { registerScope } from "../lib/scopeState"
import type { HotkeyScope } from "../types/HotkeyScope"
import type { HotkeyScopeOptions } from "../types/HotkeyScopeOptions"

let anonymous = 0

/**
 * A layer of hotkeys. Inactive in every Store until `activateHotkeyScope` (or
 * `useHotkeyScope`) activates it in that Store. While active, its bindings
 * outrank lower layers; an `exclusive` scope also makes every layer with a
 * lower priority ineligible.
 */
export const hotkeyScope = (options: HotkeyScopeOptions = {}): HotkeyScope => {
    const priority = options.priority ?? 0
    if (typeof priority !== "number" || !Number.isFinite(priority))
        throw new TypeError("hotkeyScope priority must be a finite number")
    const scope: HotkeyScope = Object.freeze({
        name: options.name ?? `scope${++anonymous}`,
        priority,
        exclusive: options.exclusive === true,
    })
    registerScope(scope)
    return scope
}
