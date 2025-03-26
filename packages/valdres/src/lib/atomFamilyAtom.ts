import type { AtomDefaultValue } from "../types/AtomDefaultValue"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { AtomFamilyGlobalAtom } from "../types/AtomFamilyGlobalAtom"
import type { AtomOptions } from "../types/AtomOptions"
import { globalAtom } from "./globalAtom"

export function atomFamilyAtom<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    defaultValue: AtomDefaultValue<Value>,
    options: AtomOptions<Value> & { global: true },
): AtomFamilyGlobalAtom<Value, Args>

export function atomFamilyAtom<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    defaultValue: AtomDefaultValue<Value>,
    options: AtomOptions<Value>,
): AtomFamilyAtom<Value, Args>

export function atomFamilyAtom<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(defaultValue: AtomDefaultValue<Value>, options: AtomOptions<Value>) {
    if (options.global) {
        return globalAtom(defaultValue, options) as AtomFamilyGlobalAtom<
            Value,
            Args
        >
    }

    return {
        ...options,
        defaultValue,
    } as AtomFamilyAtom<Value, Args>
}
