import { eventHandler } from "./eventHandler"
import { clearAllPressed } from "./clearAllPressed"

let cleanup: (() => void) | null = null

export const init = () => {
    if (cleanup) return cleanup
    if (typeof document === "undefined") return

    document.addEventListener("keydown", eventHandler)
    document.addEventListener("keyup", eventHandler)
    window.addEventListener("blur", clearAllPressed)

    cleanup = () => {
        document.removeEventListener("keydown", eventHandler)
        document.removeEventListener("keyup", eventHandler)
        window.removeEventListener("blur", clearAllPressed)
        cleanup = null
    }

    return cleanup
}
