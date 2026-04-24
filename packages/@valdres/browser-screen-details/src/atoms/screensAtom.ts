import { atom } from "valdres"
import type { ScreenDetail } from "../../types/ScreenDetail"

export const screensAtom = atom<ScreenDetail[]>([], {
    global: true,
    name: "@valdres/browser-screen-details/screens",
})
