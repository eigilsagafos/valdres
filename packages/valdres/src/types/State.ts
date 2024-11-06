import type { Atom } from "./Atom"
import type { AtomFamily } from "./AtomFamily"
import type { Selector } from "./Selector"

export type State<K = any, V = any> = Atom<V> | Selector<V> | AtomFamily<K, V>
