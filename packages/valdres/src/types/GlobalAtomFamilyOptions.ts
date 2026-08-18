import type { AtomFamilyOptions } from "./AtomFamilyOptions"

/** Options for `globalAtomFamily()`. Identical to {@link AtomFamilyOptions},
 *  except `name` is required — a global family's name is its registry
 *  address, so unlike an ordinary family it cannot be omitted. */
export type GlobalAtomFamilyOptions<
    Value = unknown,
    Args extends [any, ...any[]] = [any, ...any[]],
> = Omit<AtomFamilyOptions<Value, Args>, "name"> & {
    name: string
}
