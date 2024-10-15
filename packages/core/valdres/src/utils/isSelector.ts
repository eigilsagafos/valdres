import type { Selector } from "../types/Selector"

export const isSelector = <V>(state: any): state is Selector<V> =>
    state && Object.hasOwn(state, "get")
