import type { Atom } from "./Atom"

export type ResetAtom = <V>(state: Atom<V>) => V | Promise<V>
