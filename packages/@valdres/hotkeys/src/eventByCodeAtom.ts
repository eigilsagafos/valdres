import { atomFamily } from "valdres"
import type { KeyboardCode } from "./types/KeyboardCode"

export const eventByCodeAtom = atomFamily<KeyboardCode[], KeyboardEvent | null>(
    null,
    {
        global: true,
        equal: (a, b) => a?.timeStamp === b?.timeStamp,
    },
)
