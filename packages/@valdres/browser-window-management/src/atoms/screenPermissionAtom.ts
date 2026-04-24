import { atom } from "valdres"
import type { ScreenPermissionState } from "../../types/ScreenPermissionState"
import { subscribe } from "../lib/subscribe"

const getInitial = (): ScreenPermissionState => {
    if (typeof window === "undefined") return "unsupported"
    if (typeof (window as { getScreenDetails?: unknown }).getScreenDetails !== "function")
        return "unsupported"
    return "prompt"
}

export const screenPermissionAtom = atom<ScreenPermissionState>(getInitial, {
    global: true,
    name: "@valdres/browser-window-management/permission",
    onInit: () => subscribe(),
})
