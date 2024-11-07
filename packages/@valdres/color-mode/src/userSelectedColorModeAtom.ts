import { atom } from "valdres"
import type { UserSelectedColorMode } from "../types/UserSelectedColorMode"

export const userSelectedColorModeAtom = atom<UserSelectedColorMode>("system", {
    global: true,
    name: "@valdres/color-mode/userSelectedColorModeAtom",
})
