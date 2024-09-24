import type { AtomFamily } from "./AtomFamily"

export type Atom<
    Value = unknown,
    FamilyKey = undefined,
    MountRes = undefined,
> = {
    defaultValue?: Value | (() => Value | Promise<Value>)
    label?: string
    family?: AtomFamily<Value, FamilyKey>
    familyKey?: FamilyKey
    onMount?: () => MountRes
    onUnmount?: (mountRes?: MountRes) => void
}
