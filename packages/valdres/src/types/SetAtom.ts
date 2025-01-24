import type { Atom } from "./Atom"
import type { SetAtomValue } from "./SetAtomValue"

// export type SetAtom<Value = unknown> = (
//     atom: Atom<Value>,
//     value: SetAtomValue<Value>,
// ) => Value

export type SetAtom = {
    <V>(atom: Atom<V>, value: SetAtomValue<V>): V
}
