import type { ToggleKey } from "../types/ToggleKey"

export const TOGGLE_KEYS: readonly ToggleKey[] = Object.freeze([
    "CapsLock",
    "NumLock",
    "ScrollLock",
])

export const isToggleKey = (code: string): code is ToggleKey =>
    (TOGGLE_KEYS as readonly string[]).includes(code)
