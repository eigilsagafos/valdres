import { globalAtom } from "valdres"

export const currentKeyCombinationAtom = globalAtom<string[]>([], {
    name: "@valdres/hotkeys/currentKeyCombinationAtom",
})
