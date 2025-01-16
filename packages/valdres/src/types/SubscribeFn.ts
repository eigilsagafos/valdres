import type { Atom } from "./Atom"
import type { Family } from "./Family"
import type { Selector } from "./Selector"

type UnsuscribeFn = () => void

export type SubscribeFn = {
    <V, K>(
        state: Family<K, V>,
        callback: (arg: K) => void,
        requireDeepEqualCheckBeforeCallback?: boolean,
    ): UnsuscribeFn
    <V>(
        state: Atom<V> | Selector<V>,
        callback: () => void,
        requireDeepEqualCheckBeforeCallback?: boolean,
    ): UnsuscribeFn
}
