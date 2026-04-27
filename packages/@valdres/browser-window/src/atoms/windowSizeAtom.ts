import { atom } from "valdres"
import type { WindowSize } from "../../types/WindowSize"
import { readWindowSize } from "../lib/readWindowSize"
import { subscribe } from "../lib/subscribe"

export const windowSizeAtom = atom<WindowSize>(readWindowSize, {
    global: true,
    name: "@valdres/browser-window/size",
    onMount: () => subscribe(),
})
