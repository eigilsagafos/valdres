import { atomFamily } from "valdres"
import type { ToggleKey } from "../types/ToggleKey"

export const toggleKeyAtom = atomFamily<boolean | null, [ToggleKey]>(null, {
    global: true,
    name: "@valdres/browser-keyboard/toggleKey",
})
