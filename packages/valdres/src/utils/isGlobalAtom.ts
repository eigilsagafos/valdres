import type { GlobalAtom } from "../types/GlobalAtom"

export const isGlobalAtom = <V>(state: any): state is GlobalAtom<V> =>
    Object.hasOwn(state, "stores")
