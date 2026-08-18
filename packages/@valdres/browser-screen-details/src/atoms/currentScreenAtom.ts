import { globalAtom } from "valdres"
import type { ScreenDetail } from "../types/ScreenDetail"

export const currentScreenAtom = globalAtom<ScreenDetail | null>(null, {
    name: "@valdres/browser-screen-details/currentScreen",
})
