import type { Atom } from "./Atom"
import type { SetAtomValue } from "./SetAtomValue"

// export type SetAtom<Value = unknown> = (
//     atom: Atom<Value>,
//     value: SetAtomValue<Value>,
// ) => Value

export type SetAtom = {
    <V>(atom: Atom<V>, value: PromiseLike<V>): Promise<V>
    <V>(atom: Atom<V>, updater: (current: V) => PromiseLike<V>): Promise<V>
    <V>(atom: Atom<V>, value: V | ((current: V) => V)): V
    <V>(atom: Atom<V>, value: SetAtomValue<V>): V | Promise<V>
}
