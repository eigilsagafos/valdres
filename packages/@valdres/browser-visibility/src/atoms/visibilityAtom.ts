import { globalAtom } from "valdres"
import { subscribe } from "../lib/subscribe"

const getInitial = (): DocumentVisibilityState => {
    if (typeof document === "undefined") return "visible"
    return document.visibilityState
}

export const visibilityAtom = globalAtom<DocumentVisibilityState>(
    getInitial,
    {
        name: "@valdres/browser-visibility/visibility",
        onMount: () => subscribe(),
    },
)
