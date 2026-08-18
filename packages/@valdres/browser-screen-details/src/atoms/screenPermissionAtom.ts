import { globalAtom } from "valdres"
import type { ScreenPermissionState } from "../types/ScreenPermissionState"
import { subscribe } from "../lib/subscribe"

const getInitial = (): ScreenPermissionState => {
    if (typeof window === "undefined") return "unsupported"
    if (typeof (window as { getScreenDetails?: unknown }).getScreenDetails !== "function")
        return "unsupported"
    return "prompt"
}

export const screenPermissionAtom = globalAtom<ScreenPermissionState>(
    getInitial,
    {
        name: "@valdres/browser-screen-details/permission",
        onMount: () => subscribe(),
    },
)
