import type { Atom } from "./types/Atom"

type AtomOptions<Value> = {
    label?: string
    onInit?: (setSelf: (value: Value) => void) => void
    onMount?: () => () => void
}

export const atom = <Value, FamilyKey = undefined>(
    defaultValue?: Value | (() => Value | Promise<Value>),
    options?: AtomOptions<Value>,
): Atom<Value, FamilyKey> => {
    if (!options) return { defaultValue }
    return {
        defaultValue,
        ...options,
    } as Atom<Value, FamilyKey>
}
