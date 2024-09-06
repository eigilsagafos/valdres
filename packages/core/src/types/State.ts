import type { Atom } from "./Atom"
import type { Selector } from "./Selector"

export type State<V = any> = Atom<V> | Selector<V>
