import type { Selector } from "../types/Selector"
import type { State } from "../types/State"

export const isSelector = (state: State): state is Selector =>
    Object.hasOwn(state, "get")
