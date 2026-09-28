import type { KeyDown } from "../types/KeyDown"

/**
 * The `KeyDown` a native event produces, or `null` when it is not an observed
 * keydown: keyups, and IME composition keydowns (`isComposing`, or the legacy
 * `keyCode` 229), which are not real key presses.
 */
export const toKeyDown = (
    event: KeyboardEvent,
    sequence: number,
): KeyDown | null => {
    if (event.type !== "keydown") return null
    if (event.isComposing || event.keyCode === 229) return null
    return Object.freeze({
        code: event.code,
        key: event.key,
        repeat: event.repeat,
        timeStamp: event.timeStamp,
        sequence,
    })
}
