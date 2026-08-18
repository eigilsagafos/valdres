/** Global atom/family names are registered addresses — a duplicate throws.
 *  Tests exercising `globalAtom()`/`globalAtomFamily()` don't care what the
 *  registered name IS (only its behavior), so this generates a name that's
 *  guaranteed unique across the whole (single-process) test run instead of
 *  relying on hand-picked literals not colliding. */
let seq = 0
export const uniqueName = (label: string): string => `${label}#${seq++}`
