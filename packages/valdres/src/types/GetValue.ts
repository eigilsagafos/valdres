import type { Atom } from "./Atom"
import type { AtomFamily } from "./AtomFamily"
import type { Selector } from "./Selector"

export type GetValue = {
    <V>(atom: Atom<V>): V
    <V>(selector: Selector<V>): V
    <V, K>(family: AtomFamily<K, V>): K[]
}
