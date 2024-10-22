import type { Atom } from "./Atom"
import type { AtomFamily } from "./AtomFamily"
import type { Selector } from "./Selector"

export type GetValue = {
    <V>(atom: Atom<V>, scopeId?: string): V
    <V>(selector: Selector<V>, scopeId?: string): V
    <V, K>(family: AtomFamily<K, V>, scopeId?: string): K[]
}
