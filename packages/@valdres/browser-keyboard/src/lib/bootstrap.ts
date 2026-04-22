import { eventHandler } from "./eventHandler"
import { clearAllPressed } from "./clearAllPressed"

export const bootstrap = () => {
    if (typeof document === "undefined") return
    document.addEventListener("keydown", eventHandler)
    document.addEventListener("keyup", eventHandler)
    if (typeof window !== "undefined") {
        window.addEventListener("blur", clearAllPressed)
    }
    return () => {
        document.removeEventListener("keydown", eventHandler)
        document.removeEventListener("keyup", eventHandler)
        if (typeof window !== "undefined") {
            window.removeEventListener("blur", clearAllPressed)
        }
        clearAllPressed()
    }
}
