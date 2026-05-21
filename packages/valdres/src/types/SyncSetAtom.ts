import type { Atom } from "./Atom"

export type SyncSetAtom = {
    <V>(atom: Atom<V>, value: V | ((current: V) => V)): V
}
