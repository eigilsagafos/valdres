import { peekKeyboardHub } from "../lib/keyboardHubs"
import type { KeyDown } from "../types/KeyDown"

/**
 * Cancels the native keydown that produced `keyDown`, but only while that
 * event is still being dispatched: synchronously inside a store update — a
 * `settle` handler or a subscriber — that the keydown caused. Anywhere else,
 * including for a `lastKeyDown` read later, it does nothing and returns
 * `false`. Returns whether the event's default is now prevented; calling it
 * again for the same keydown, from any store, is harmless.
 */
export const preventKeyDownDefault = (keyDown: KeyDown): boolean =>
    peekKeyboardHub()?.preventDefault(keyDown.sequence) ?? false
