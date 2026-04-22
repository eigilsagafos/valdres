import { pressedKeysAtom } from "../atoms/pressedKeysAtom"
import { toggleKeyAtom } from "../atoms/toggleKeyAtom"
import type { ToggleKey } from "../../types/ToggleKey"
import { locksState } from "./locksState"

const toggleKeys: ToggleKey[] = ["CapsLock", "NumLock", "ScrollLock"]

export const clearAllPressed = () => {
    pressedKeysAtom.setSelf([])
    for (const key of toggleKeys) {
        toggleKeyAtom(key).setSelf(null)
    }
    locksState.initialized = false
}
