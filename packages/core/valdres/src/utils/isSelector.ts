import type { Selector } from "../types/Selector"

export const isSelector = (state: any): state is Selector =>
    state && Object.hasOwn(state, "get")
