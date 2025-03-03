import { atomFamily } from "valdres"

export const eventByKeyAtom = atomFamily<string[], KeyboardEvent | null>(null, {
    global: true,
    equal: (a, b) => a?.timeStamp === b?.timeStamp,
    name: "@valdres/hotkeys/eventByKeyAtom",
})
