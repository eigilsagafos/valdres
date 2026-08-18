import { globalAtom } from "valdres"
import type { WindowSize } from "../types/WindowSize"
import { readWindowSize } from "../lib/readWindowSize"
import { subscribe } from "../lib/subscribe"

export const windowSizeAtom = globalAtom<WindowSize>(readWindowSize, {
    name: "@valdres/browser-window/size",
    onMount: () => subscribe(),
})
