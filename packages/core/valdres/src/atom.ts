import type { Atom } from "./types/Atom"

type AtomOptions<Value, MountRes = undefined> = {
    label?: string
    onInit?: (setSelf: (value: Value) => void) => void
    onMount?: () => MountRes
    onUnmount?: (mountRes?: MountRes) => void
}

export const atom = <
    Value,
    FamilyKey = undefined,
    MountReturnValue = undefined,
>(
    defaultValue?: Value | (() => Value | Promise<Value>),
    options?: AtomOptions<Value, MountReturnValue>,
): Atom<Value, FamilyKey> => {
    if (!options) return { defaultValue }
    return {
        defaultValue,
        ...options,
    } as Atom<Value, FamilyKey>
}
