import { atomFamily } from "valdres"
import type { KeyboardCode } from "../types/KeyboardCode"

export const eventByCodeAtom = atomFamily<
    KeyboardEvent | null,
    [KeyboardCode[]]
>(null, {
    global: true,
    equal: (a, b) => a?.timeStamp === b?.timeStamp,
    name: "@valdres/hotkeys/eventByCodeAtom",
})
