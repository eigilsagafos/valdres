import type { KeyboardSnapshot } from "../types/KeyboardSnapshot"

/**
 * Nothing observed: no pressed keys, every lock unknown. This one frozen object
 * is the server snapshot, the value before activation, and the value after a
 * focus-loss reset, so all three compare equal by identity.
 */
export const EMPTY_KEYBOARD_SNAPSHOT: KeyboardSnapshot = Object.freeze({
    pressed: Object.freeze([]),
    locks: Object.freeze({ CapsLock: null, NumLock: null, ScrollLock: null }),
})
