import { externalAtom, type ExternalAtom } from "valdres"
import { windowSizeSource } from "../lib/windowSizeSource"
import type { WindowSize } from "../types/WindowSize"

export const windowSizeAtom: ExternalAtom<WindowSize> = externalAtom(
    windowSizeSource,
    { name: "@valdres/browser-window/size" },
)
