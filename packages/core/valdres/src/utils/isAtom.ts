import type { Atom } from "../types/Atom"

export const isAtom = (state: any): state is Atom =>
    Object.hasOwn(state, "defaultValue")
