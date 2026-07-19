import { atomFamily } from "valdres"
import type { KeyboardCode } from "./types/KeyboardCode"

export const eventByCodeAtom = atomFamily<
    KeyboardEvent | null,
    [KeyboardCode[]]
>(null, {
    global: true,
    equal: (a, b) => a?.timeStamp === b?.timeStamp,
    // KeyboardEvent is a branded browser host object, so it cannot participate
    // in Valdres' safe deep-freeze contract.
    mutable: true,
    name: "@valdres/hotkeys/eventByCodeAtom",
})
