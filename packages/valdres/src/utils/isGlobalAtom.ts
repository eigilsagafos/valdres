import type { GlobalAtom } from "../types/GlobalAtom"

export const isGlobalAtom = <V>(state: any): state is GlobalAtom<V> =>
    state && Object.hasOwn(state, "stores")
