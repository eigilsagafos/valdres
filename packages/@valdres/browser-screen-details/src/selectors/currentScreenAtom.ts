import { selector, type Selector } from "valdres"
import { screenDetailsAtom } from "../atoms/screenDetailsAtom"
import type { ScreenDetail } from "../types/ScreenDetail"

/** The screen the window is on while access is granted, otherwise `null`. */
export const currentScreenAtom: Selector<ScreenDetail | null> = selector(
    get => get(screenDetailsAtom).currentScreen,
    { name: "@valdres/browser-screen-details/currentScreen" },
)
