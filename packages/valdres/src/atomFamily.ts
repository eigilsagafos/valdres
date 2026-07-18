import { createAtomFamily } from "./lib/createAtomFamily"
import { createGlobalAtomFamily } from "./lib/createGlobalAtomFamily"
import type { AtomFamily } from "./types/AtomFamily"
import type { AtomFamilyDefaultValue } from "./types/AtomFamilyDefaultValue"
import type { AtomFamilyAtom } from "./types/AtomFamilyAtom"
import type { AtomFamilyOptions } from "./types/AtomFamilyOptions"
import type { GlobalAtom } from "./types/GlobalAtom"

type GlobalAtomFamily<
    Value,
    Args extends [any, ...any[]] = [any, ...any[]],
> = Omit<AtomFamily<Value, Args>, never> & {
    (...args: Args): AtomFamilyAtom<Value, Args> & GlobalAtom<Value>
}

export function atomFamily<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    defaultValue: AtomFamilyDefaultValue<Value, Args> | undefined,
    options: AtomFamilyOptions<Value, Args> & { global: true },
): GlobalAtomFamily<Value, Args>
export function atomFamily<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    defaultValue?: AtomFamilyDefaultValue<Value, Args>,
    options?: AtomFamilyOptions<Value, Args>,
): AtomFamily<Value, Args>
export function atomFamily<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    defaultValue?: AtomFamilyDefaultValue<Value, Args>,
    options?: AtomFamilyOptions<Value, Args>,
) {
    if (options?.global) return createGlobalAtomFamily(defaultValue, options)
    return createAtomFamily(defaultValue, options)
}
