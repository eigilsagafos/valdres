import type { Atom } from "./types/Atom"

type AtomOptions<MountRes = undefined> = {
    label?: string
    onInit?: () => void
    onMount?: () => MountRes
    onUnmount?: (mountRes?: MountRes) => void
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
    } as Atom<Value, FamilyKey>
}
