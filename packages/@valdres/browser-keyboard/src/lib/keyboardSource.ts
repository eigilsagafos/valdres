import type { ExternalSource } from "valdres"
import type { KeyboardSnapshot } from "../types/KeyboardSnapshot"
import { EMPTY_KEYBOARD_SNAPSHOT } from "./emptyKeyboardSnapshot"
import { activateKeyboardHub, peekKeyboardHub } from "./keyboardHubs"

const noop = () => {}

export const keyboardSource: ExternalSource<KeyboardSnapshot> = {
    // A dormant read reports what an activated hub has observed, or nothing.
    // It never activates: listeners start through `subscribe` or `activateKeyboard()`.
    getSnapshot: () => peekKeyboardHub()?.snapshot() ?? EMPTY_KEYBOARD_SNAPSHOT,
    getServerSnapshot: () => EMPTY_KEYBOARD_SNAPSHOT,
    // A store subscription activates the hub. The unsubscribe removes only
    // this invalidator; the hub keeps tracking.
    subscribe: invalidate => activateKeyboardHub()?.subscribe(invalidate) ?? noop,
}
