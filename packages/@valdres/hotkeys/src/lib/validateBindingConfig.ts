import type { BindingConfig } from "./registry"
import { isHotkeyScope } from "./scopeState"

const FLAGS = [
    "repeat",
    "editable",
    "preventDefault",
    "handleDefaultPrevented",
] as const

/**
 * Throws `TypeError` for a configuration dispatch cannot rank or read. Run on
 * registration, and by the React binding on every render before an update is
 * adopted, so an invalid update never reaches a registered binding.
 */
export const validateBindingConfig = (config: BindingConfig): void => {
    if (typeof config.command !== "function")
        throw new TypeError("A hotkey command must be a function")
    if (
        config.priority !== undefined &&
        (typeof config.priority !== "number" ||
            !Number.isFinite(config.priority))
    )
        throw new TypeError("Hotkey priority must be a finite number")
    if (config.scope !== undefined && !isHotkeyScope(config.scope))
        throw new TypeError("Hotkey scope must come from hotkeyScope()")
    const { enabled } = config
    if (
        enabled !== undefined &&
        typeof enabled !== "boolean" &&
        (enabled === null ||
            (typeof enabled !== "object" && typeof enabled !== "function"))
    )
        throw new TypeError(
            "Hotkey enabled must be a boolean or a State<boolean>",
        )
    for (const flag of FLAGS)
        if (config[flag] !== undefined && typeof config[flag] !== "boolean")
            throw new TypeError(`Hotkey ${flag} must be a boolean`)
}
