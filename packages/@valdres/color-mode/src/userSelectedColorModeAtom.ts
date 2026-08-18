import { globalAtom } from "valdres"
import type { UserSelectedColorMode } from "./types/UserSelectedColorMode"

export const userSelectedColorModeAtom = globalAtom<UserSelectedColorMode>(
    "system",
    { name: "@valdres/color-mode/userSelectedColorModeAtom" },
)
