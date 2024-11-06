import { atom } from "valdres"

export const currentKeyCombinationAtom = atom<string[]>([], {
    global: true,
    label: "@valdres/hotkeys/currentKeyCombinationAtom",
})
