import { atom } from "valdres"
import type { ScreenInfo } from "../types/ScreenInfo"
import { readScreen } from "../lib/readScreen"
import { subscribe } from "../lib/subscribe"

export const screenAtom = atom<ScreenInfo>(readScreen, {
    global: true,
    name: "@valdres/browser-screen/screen",
    onMount: () => subscribe(),
})
