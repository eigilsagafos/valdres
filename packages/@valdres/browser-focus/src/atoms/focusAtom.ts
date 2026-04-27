import { atom } from "valdres"
import { subscribe } from "../lib/subscribe"

const getInitial = () => {
    if (typeof document === "undefined") return true
    return document.hasFocus()
}

export const focusAtom = atom<boolean>(getInitial, {
    global: true,
    name: "@valdres/browser-focus/focus",
    onMount: () => subscribe(),
})
