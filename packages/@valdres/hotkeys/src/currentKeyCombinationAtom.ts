import { atom } from "valdres"

export const currentKeyCombinationAtom = atom<string[]>([], {
    global: true,
    name: "@valdres/hotkeys/currentKeyCombinationAtom",
})
