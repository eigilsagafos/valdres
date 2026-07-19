import type { Atom } from "./Atom"
import type { AtomOnInit } from "./AtomOnInit"

/** Engine-only atom fields that are deliberately absent from the public type. */
export type InternalAtom<Value = unknown> = Atom<Value> & {
    onInit?: AtomOnInit<Value>
}
