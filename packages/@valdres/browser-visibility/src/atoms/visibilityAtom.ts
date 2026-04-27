import { atom } from "valdres"
import { subscribe } from "../lib/subscribe"

const getInitial = (): DocumentVisibilityState => {
    if (typeof document === "undefined") return "visible"
    return document.visibilityState
}

export const visibilityAtom = atom<DocumentVisibilityState>(getInitial, {
    global: true,
    name: "@valdres/browser-visibility/visibility",
    onMount: () => subscribe(),
})
