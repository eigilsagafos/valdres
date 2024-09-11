import type { Atom } from "./types/Atom"

type AtomOptions<M = any> = {
    label?: string
    onInit?: () => void
    onMount?: () => M
    onUnmount?: (mountRes?: M) => void
}

export const atom = <
    Value,
    FamilyKey = undefined,
    MountReturnValue = undefined,
>(
    defaultValue?: Value | (() => Value | Promise<Value>),
    options?: AtomOptions<MountReturnValue>,
    // debugLabel?: string,
    // debugLabel?: string,
): Atom<Value, FamilyKey> => {
    if (!options) return { defaultValue }
    return {
        defaultValue,
        ...options,
    }
}
