import type { Atom } from "../types/Atom"
import type { State } from "../types/State"

export const isAtom = (state: State): state is Atom =>
    Object.hasOwn(state, "defaultValue")
