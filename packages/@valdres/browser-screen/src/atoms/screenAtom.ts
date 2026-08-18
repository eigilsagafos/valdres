import { globalAtom } from "valdres"
import type { ScreenInfo } from "../types/ScreenInfo"
import { readScreen } from "../lib/readScreen"
import { subscribe } from "../lib/subscribe"

export const screenAtom = globalAtom<ScreenInfo>(readScreen, {
    name: "@valdres/browser-screen/screen",
    onMount: () => subscribe(),
})
