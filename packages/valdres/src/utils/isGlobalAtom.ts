import type { InternalGlobalAtom } from "../types/InternalGlobalAtom"

export const isGlobalAtom = <V>(state: any): state is InternalGlobalAtom<V> =>
    state && Object.hasOwn(state, "stores")
