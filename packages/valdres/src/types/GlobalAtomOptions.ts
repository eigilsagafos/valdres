import type { AtomOptions } from "./AtomOptions"

/** Options for `globalAtom()`. Identical to {@link AtomOptions}, except `name`
 *  is required — a global atom's name is its registry address, so unlike an
 *  ordinary atom it cannot be omitted. */
export type GlobalAtomOptions<Value = unknown> = Omit<
    AtomOptions<Value>,
    "name"
> & {
    name: string
}
