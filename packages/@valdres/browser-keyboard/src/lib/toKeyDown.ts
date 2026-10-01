import type { KeyDown } from "../types/KeyDown"

/** What the keyboard's listener saw when it received the event. */
export interface KeyDownObservation {
    readonly editable: boolean
    readonly defaultPrevented: boolean
}

/**
 * The `KeyDown` a native event produces, or `null` when it is not an observed
 * keydown: keyups, and IME composition keydowns (`isComposing`, or the legacy
 * `keyCode` 229), which are not real key presses.
 */
export const toKeyDown = (
    event: KeyboardEvent,
    sequence: number,
    observation: KeyDownObservation,
): KeyDown | null => {
    if (event.type !== "keydown") return null
    if (event.isComposing || event.keyCode === 229) return null
    return Object.freeze({
        code: event.code,
        key: event.key,
        repeat: event.repeat,
        timeStamp: event.timeStamp,
        sequence,
        editable: observation.editable,
        defaultPrevented: observation.defaultPrevented,
    })
}
