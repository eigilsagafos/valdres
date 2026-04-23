import { atom } from "valdres"
import { subscribe } from "../lib/subscribe"

const getInitial = () => {
    if (typeof navigator === "undefined") return true
    return navigator.onLine
}

export const onlineAtom = atom<boolean>(getInitial, {
    global: true,
    name: "@valdres/browser-online/online",
    onInit: () => subscribe(),
})
