import type { KeyboardSnapshot } from "../types/KeyboardSnapshot"
import type { KeyboardSourceSnapshot } from "./KeyboardSourceSnapshot"

/**
 * Nothing observed: no pressed keys, every lock unknown. This one frozen object
 * is the server snapshot, the value before activation, and the value after a
 * focus-loss reset, so all three compare equal by identity.
 */
export const EMPTY_KEYBOARD_SNAPSHOT: KeyboardSnapshot = Object.freeze({
    pressed: Object.freeze([]),
    locks: Object.freeze({ CapsLock: null, NumLock: null, ScrollLock: null }),
})

/** The hub's source value with nothing observed and no keydown yet. */
export const EMPTY_KEYBOARD_SOURCE_SNAPSHOT: KeyboardSourceSnapshot =
    Object.freeze({ keyboard: EMPTY_KEYBOARD_SNAPSHOT, lastKeyDown: null })
