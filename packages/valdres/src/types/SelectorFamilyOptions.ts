import type { FamilyKey } from "./FamilyKey"
import type { SelectorOptions } from "./SelectorOptions"

export type SelectorFamilyOptions<
    Value extends any = any,
    Args extends [any, ...any[]] = [any, ...any[]],
> = SelectorOptions<Value> & {
    /** Derive deterministic cache identity from arguments the built-in family
     * key codec does not support, or intentionally group multiple arguments. */
    keyOf?: (...args: Args) => FamilyKey
}
