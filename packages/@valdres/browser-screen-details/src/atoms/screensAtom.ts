import { globalAtom } from "valdres"
import type { ScreenDetail } from "../types/ScreenDetail"

export const screensAtom = globalAtom<ScreenDetail[]>([], {
    name: "@valdres/browser-screen-details/screens",
})
