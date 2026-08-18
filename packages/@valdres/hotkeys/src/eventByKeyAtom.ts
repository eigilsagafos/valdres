import { globalAtomFamily } from "valdres"

export const eventByKeyAtom = globalAtomFamily<
    KeyboardEvent | null,
    [string[]]
>(null, {
    name: "@valdres/hotkeys/eventByKeyAtom",
    equal: (a, b) => a?.timeStamp === b?.timeStamp,
    // KeyboardEvent is a branded browser host object, so it cannot
    // participate in Valdres' safe deep-freeze contract.
    mutable: true,
})
