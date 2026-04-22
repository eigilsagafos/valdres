import { atom } from "valdres"
import type { PressedKey } from "../../types/PressedKey"
import { eventHandler } from "../lib/eventHandler"
import { clearAllPressed } from "../lib/clearAllPressed"

export const pressedKeysAtom = atom<PressedKey[]>([], {
    global: true,
    name: "@valdres/browser-keyboard/pressedKeys",
    onInit: () => {
        if (typeof document === "undefined") return
        document.addEventListener("keydown", eventHandler)
        document.addEventListener("keyup", eventHandler)
        window.addEventListener("blur", clearAllPressed)
        return () => {
            document.removeEventListener("keydown", eventHandler)
            document.removeEventListener("keyup", eventHandler)
            window.removeEventListener("blur", clearAllPressed)
        }
    },
})
