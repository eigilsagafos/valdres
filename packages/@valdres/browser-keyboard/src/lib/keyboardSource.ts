import type { ExternalSource } from "valdres"
import { EMPTY_KEYBOARD_SOURCE_SNAPSHOT } from "./emptyKeyboardSnapshot"
import { activateKeyboardHub, peekKeyboardHub } from "./keyboardHubs"
import type { KeyboardSourceSnapshot } from "./KeyboardSourceSnapshot"

const noop = () => {}

export const keyboardSource: ExternalSource<KeyboardSourceSnapshot> = {
    // A dormant read reports what an activated hub has observed, or nothing.
    // It never activates: listeners start through `subscribe` or `activateKeyboard()`.
    getSnapshot: () =>
        peekKeyboardHub()?.snapshot() ?? EMPTY_KEYBOARD_SOURCE_SNAPSHOT,
    getServerSnapshot: () => EMPTY_KEYBOARD_SOURCE_SNAPSHOT,
    // A store subscription activates the hub. The unsubscribe removes only
    // this invalidator; the hub keeps tracking.
    subscribe: invalidate =>
        activateKeyboardHub()?.subscribe(invalidate) ?? noop,
}
