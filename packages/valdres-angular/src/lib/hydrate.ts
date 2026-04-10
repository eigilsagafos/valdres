import type { Atom, SetAtom } from "valdres"

export const hydrate = (set: SetAtom, state: [Atom, any][]) => {
    for (const [atom, value] of state) {
        set(atom, value)
    }
}
