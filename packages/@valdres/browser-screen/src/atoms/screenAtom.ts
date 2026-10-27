import { externalAtom, type ExternalAtom } from "valdres"
import { screenSource } from "../lib/screenSource"
import type { ScreenInfo } from "../types/ScreenInfo"

export const screenAtom: ExternalAtom<ScreenInfo> = externalAtom(screenSource, {
    name: "@valdres/browser-screen/screen",
})
