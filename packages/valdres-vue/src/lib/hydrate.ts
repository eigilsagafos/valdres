import type { Atom, SyncSetAtom } from "valdres"

export const hydrate = (set: SyncSetAtom, state: [Atom, any][]) => {
    for (const [atom, value] of state) {
        set(atom, value)
    }
}
