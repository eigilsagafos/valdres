import { eventHandler } from "./eventHandler"

export const subscribe = () => {
    if (typeof window === "undefined") return
    eventHandler()
    window.addEventListener("online", eventHandler)
    window.addEventListener("offline", eventHandler)
    return () => {
        window.removeEventListener("online", eventHandler)
        window.removeEventListener("offline", eventHandler)
    }
}
