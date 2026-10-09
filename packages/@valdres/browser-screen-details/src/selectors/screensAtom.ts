import { selector, type Selector } from "valdres"
import { screenDetailsAtom } from "../atoms/screenDetailsAtom"
import type { ScreenDetail } from "../types/ScreenDetail"

/** Every connected screen while access is granted, otherwise empty. */
export const screensAtom: Selector<readonly ScreenDetail[]> = selector(
    get => get(screenDetailsAtom).screens,
    { name: "@valdres/browser-screen-details/screens" },
)
