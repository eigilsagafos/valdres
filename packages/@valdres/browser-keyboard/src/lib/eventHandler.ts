import { pressedKeysAtom } from "../atoms/pressedKeysAtom"
import { toggleKeyAtom } from "../atoms/toggleKeyAtom"
import type { ToggleKey } from "../types/ToggleKey"
import type { PressedKey } from "../types/PressedKey"
import { isAppleLike } from "./isAppleLike"
import { locksState } from "./locksState"

const toggleKeys: ToggleKey[] = ["CapsLock", "NumLock", "ScrollLock"]

export const eventHandler = (event: KeyboardEvent) => {
    // Ignore IME composition events — during CJK/Vietnamese input, browsers
    // fire keydown with keyCode 229 that doesn't represent a real key press.
    if (event.isComposing || event.keyCode === 229) return

    // Seed all toggle key states from the first event, then only update
    // the specific one when its key is pressed.
    const isToggleKey = toggleKeys.includes(event.code as ToggleKey)
    if (!locksState.initialized) {
        for (const lock of toggleKeys) {
            toggleKeyAtom(lock).setSelf(event.getModifierState(lock))
        }
        locksState.initialized = true
    } else if (isToggleKey) {
        toggleKeyAtom(event.code as ToggleKey).setSelf(
            event.getModifierState(event.code),
        )
    }

    // Toggle keys are tracked via toggleKeyAtom, not in pressedKeysAtom.
    if (isToggleKey) return

    const { type, code, key, timeStamp, target } = event

    if (type === "keydown") {
        let current = pressedKeysAtom.getSelf()

        // On macOS, when Meta (Cmd) is held and other keys are pressed, the
        // keyup events for those other keys never fire. Truncate back to Meta
        // on each new keydown while Meta is held.
        if (isAppleLike()) {
            const metaLeftIdx = current.findIndex(k => k.code === "MetaLeft")
            const metaRightIdx = current.findIndex(k => k.code === "MetaRight")
            const metaIdx = Math.max(metaLeftIdx, metaRightIdx)
            if (metaIdx !== -1) {
                current = current.slice(0, metaIdx + 1)
            }
        }

        if (!current.some(k => k.code === code)) {
            const pressed: PressedKey = { code, key, timeStamp, target }
            pressedKeysAtom.setSelf([...current, pressed])
        }

    } else if (type === "keyup") {
        const current = pressedKeysAtom.getSelf()

        // On macOS, when Meta is released, clear all pressed keys — the OS
        // swallows keyup events for keys pressed while Meta was held, so we
        // can't know which keys are still physically down.
        if (isAppleLike() && (code === "MetaLeft" || code === "MetaRight")) {
            pressedKeysAtom.setSelf([])
        } else {
            pressedKeysAtom.setSelf(current.filter(k => k.code !== code))
        }

    }
}
