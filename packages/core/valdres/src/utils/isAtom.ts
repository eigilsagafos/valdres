import type { State } from "../types/State"

export const isAtom = (state: State) => Object.hasOwn(state, "defaultValue")
