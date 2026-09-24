import type { PressedKey } from "./PressedKey"
import type { ToggleKey } from "./ToggleKey"

/**
 * Immutable keyboard state observed by one document's hub since activation.
 * `locks` are `null` until the first accepted key event after activation or a
 * focus-loss reset; the platform offers no way to read them earlier.
 */
export type KeyboardSnapshot = Readonly<{
    pressed: readonly PressedKey[]
    locks: Readonly<Record<ToggleKey, boolean | null>>
}>
