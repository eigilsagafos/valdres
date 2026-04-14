import type { Atom } from "./Atom"
import type { Selector } from "./Selector"

export type Reactive<T> = T | Atom<T> | Selector<T>
