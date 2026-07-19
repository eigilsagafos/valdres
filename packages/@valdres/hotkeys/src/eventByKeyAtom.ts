import { atomFamily } from "valdres"

export const eventByKeyAtom = atomFamily<KeyboardEvent | null, [string[]]>(
    null,
    {
        global: true,
        equal: (a, b) => a?.timeStamp === b?.timeStamp,
        // KeyboardEvent is a branded browser host object, so it cannot
        // participate in Valdres' safe deep-freeze contract.
        mutable: true,
        name: "@valdres/hotkeys/eventByKeyAtom",
    },
)
