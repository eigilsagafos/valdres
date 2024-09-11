import { eventHandler } from "./eventHandler"

let listening = false

export const registerListeners = () => {
    if (listening) return
    document.addEventListener("keydown", eventHandler)
    document.addEventListener("keyup", eventHandler)
    listening = true
}
