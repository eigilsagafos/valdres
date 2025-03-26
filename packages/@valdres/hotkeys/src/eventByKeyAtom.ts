import { atomFamily } from "valdres"

export const eventByKeyAtom = atomFamily<KeyboardEvent | null, [string[]]>(
    null,
    {
        global: true,
        equal: (a, b) => a?.timeStamp === b?.timeStamp,
        name: "@valdres/hotkeys/eventByKeyAtom",
    },
)
