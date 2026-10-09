import { selector, type Selector } from "valdres"
import { screenDetailsAtom } from "../atoms/screenDetailsAtom"
import type { ScreenDetailsStatus } from "../types/ScreenDetailsStatus"

export const screenDetailsStatusAtom: Selector<ScreenDetailsStatus> = selector(
    get => get(screenDetailsAtom).status,
    { name: "@valdres/browser-screen-details/status" },
)
