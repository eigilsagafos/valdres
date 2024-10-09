import { globalAtom } from "./lib/globalAtom"
import type { Atom } from "./types/Atom"
import type { AtomOptions } from "./types/AtomOptions"
import type { Selector } from "./types/Selector"

export const atom = <Value = any, FamilyKey = undefined>(
    defaultValue?: Value | (() => Value | Promise<Value>) | Selector<Value>,
    options?: AtomOptions<Value>,
): Atom<Value, FamilyKey> => {
    if (!options) return { defaultValue }
    // @ts-ignore @ts-todo
    if (options.global) return globalAtom(defaultValue, options)
    return {
        defaultValue,
        ...options,
    } as Atom<Value, FamilyKey>
}
