import type { Atom } from "../types/Atom"

export const isAtom = <V>(state: any): state is Atom<V> =>
    state && Object.hasOwn(state, "defaultValue")
