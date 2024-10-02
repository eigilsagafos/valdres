import type { Atom } from "./Atom"
import type { AtomFamily } from "./AtomFamily"
import type { Selector } from "./Selector"

export type GetValue = {
    <V, K>(atom: Atom<V>): V
    <V, K>(selector: Selector<V>): V
    <V, K>(family: AtomFamily<unknown, K>): K[]
}
