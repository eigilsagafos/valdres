import type { ExternalSource } from "valdres"
import type { KeyDown } from "../types/KeyDown"
import { activateKeyboardHub, peekKeyboardHub } from "./keyboardHubs"

const noop = () => {}

export const lastKeyDownSource: ExternalSource<KeyDown | null> = {
    // Same lifetime as `keyboardSource`: dormant reads never activate, and a
    // subscription activates the shared hub without adding native listeners.
    getSnapshot: () => peekKeyboardHub()?.lastKeyDown.current() ?? null,
    getServerSnapshot: () => null,
    subscribe: invalidate =>
        activateKeyboardHub()?.lastKeyDown.subscribe(invalidate) ?? noop,
}
