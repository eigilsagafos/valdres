import { atom, selector } from "valdres"
import { scopeCounts } from "../lib/scopeCounts"
import type { HotkeyScope } from "../types/HotkeyScope"
import type { HotkeyScopeOptions } from "../types/HotkeyScopeOptions"

let anonymous = 0

/**
 * A layer of hotkeys. Inactive in every store until `activateHotkeyScope` (or
 * `useHotkeyScope`) activates it there. While active, its bindings outrank
 * lower layers; an `exclusive` scope also makes every lower layer ineligible.
 */
export const hotkeyScope = (options: HotkeyScopeOptions = {}): HotkeyScope => {
    const name = options.name ?? `scope${++anonymous}`
    const priority = options.priority ?? 0
    if (typeof priority !== "number" || !Number.isFinite(priority))
        throw new TypeError("hotkeyScope priority must be a finite number")
    const count = atom(0, { name: `@valdres/hotkeys/scope/${name}/count` })
    const scope: HotkeyScope = Object.freeze({
        name,
        priority,
        exclusive: options.exclusive === true,
        active: selector(get => get(count) > 0, {
            name: `@valdres/hotkeys/scope/${name}/active`,
        }),
    })
    scopeCounts.set(scope, count)
    return scope
}
