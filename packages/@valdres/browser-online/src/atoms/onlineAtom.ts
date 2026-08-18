import { globalAtom } from "valdres"
import { subscribe } from "../lib/subscribe"

const getInitial = () => {
    if (typeof navigator === "undefined") return true
    return navigator.onLine
}

export const onlineAtom = globalAtom<boolean>(getInitial, {
    name: "@valdres/browser-online/online",
    onMount: () => subscribe(),
})
