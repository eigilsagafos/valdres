import { globalAtomFamily } from "valdres"
import type { ToggleKey } from "../types/ToggleKey"

export const toggleKeyAtom = globalAtomFamily<boolean | null, [ToggleKey]>(
    null,
    { name: "@valdres/browser-keyboard/toggleKey" },
)
