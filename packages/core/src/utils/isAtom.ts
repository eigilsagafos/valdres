import type { Atom } from "../types/Atom"

export const isAtom = (state: Atom<any>) => Object.hasOwn(state, "defaultValue")
