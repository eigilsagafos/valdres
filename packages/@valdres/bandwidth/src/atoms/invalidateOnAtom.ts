import { atom } from "valdres"
import type { Atom } from "valdres"

export const invalidateOnAtom = atom<Atom<unknown>[]>([], {
    global: true,
    // `mutable: true` exempts this value from the dev-mode deepFreeze that
    // would otherwise recurse into the array and freeze the atoms inside —
    // breaking their internal refCount/listener mutations.
    mutable: true,
    name: "@valdres/bandwidth/invalidateOn",
})
