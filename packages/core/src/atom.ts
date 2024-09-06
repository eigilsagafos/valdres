import type { Atom } from "./types/Atom"

export const atom = <Value, FamilyKey = undefined>(
    defaultValue?: Value | (() => Value | Promise<Value>),
    debugLabel?: string,
): Atom<Value, FamilyKey> => ({
    defaultValue,
    debugLabel,
    // isAtom: true,
})
