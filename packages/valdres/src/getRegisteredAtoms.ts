import { registeredAtomsByName } from "./lib/atomRegistry"
import type { Atom } from "./types/Atom"

/**
 * Returns a name → atom map of every `atom(...)` declared with a `name`.
 * Useful for devtools-style consumers that need to enumerate named state
 * (e.g. to build an initial snapshot) or resolve a name back to its atom
 * (e.g. for time-travel restore). Family member atoms are not included.
 */
export const getRegisteredAtoms = (): ReadonlyMap<string, Atom<any>> =>
    registeredAtomsByName()
