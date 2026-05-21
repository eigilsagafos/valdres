import { atom } from "valdres"
import type { ScreenDetail } from "../types/ScreenDetail"

export const currentScreenAtom = atom<ScreenDetail | null>(null, {
    global: true,
    name: "@valdres/browser-screen-details/currentScreen",
})
