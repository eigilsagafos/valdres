import { onlineAtom } from "../atoms/onlineAtom"

const update = () => onlineAtom.setSelf(navigator.onLine)

export const subscribe = () => {
    if (typeof window === "undefined") return
    update()
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => {
        window.removeEventListener("online", update)
        window.removeEventListener("offline", update)
    }
}
