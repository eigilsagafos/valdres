import { onlineAtom } from "../atoms/onlineAtom"

export const eventHandler = () => {
    if (typeof navigator === "undefined") return
    onlineAtom.setSelf(navigator.onLine)
}
