import { globalAtomFamily } from "valdres"
import type { KeyboardCode } from "./types/KeyboardCode"

export const eventByCodeAtom = globalAtomFamily<
    KeyboardEvent | null,
    [KeyboardCode[]]
>(null, {
    name: "@valdres/hotkeys/eventByCodeAtom",
    equal: (a, b) => a?.timeStamp === b?.timeStamp,
    // KeyboardEvent is a branded browser host object, so it cannot participate
    // in Valdres' safe deep-freeze contract.
    mutable: true,
})
