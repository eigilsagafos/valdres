import type { Atom } from "../types/Atom"

/**
 * Name → atom map for every `atom(...)` declared with a `name`. Used by
 * devtools-style consumers to (a) enumerate already-existing named state for
 * an initial snapshot — `data.values` is a non-enumerable WeakMap — and (b)
 * resolve a name back to its atom for time-travel restore.
 *
 * Holds named atoms strongly. Named atoms are expected to be long-lived
 * module singletons, so this is fine in practice; do not give dynamically
 * created (per-iteration) atoms a `name` if you create many of them.
 */
const byName = new Map<string, Atom<any>>()

export const registerNamedAtom = (atom: Atom<any>): void => {
    if (atom.name) byName.set(atom.name, atom)
}

export const registeredAtomsByName = (): ReadonlyMap<string, Atom<any>> =>
    byName
