import { globalAtom } from "valdres"
import { subscribe } from "../lib/subscribe"

const getInitial = () => {
    if (typeof document === "undefined") return true
    return document.hasFocus()
}

export const focusAtom = globalAtom<boolean>(getInitial, {
    name: "@valdres/browser-focus/focus",
    onMount: () => subscribe(),
})
