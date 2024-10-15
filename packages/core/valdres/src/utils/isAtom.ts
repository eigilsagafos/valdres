import type { Atom } from "../types/Atom"

export const isAtom = <V>(state: any): state is Atom<V> =>
    Object.hasOwn(state, "defaultValue")
