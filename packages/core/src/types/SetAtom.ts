import type { Atom } from "./Atom"

export type SetAtom = <V>(atom: Atom<V>, value: V) => void
