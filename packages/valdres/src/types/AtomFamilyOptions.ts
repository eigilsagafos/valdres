import type { AtomOptions } from "./AtomOptions"
import type { FamilyKey } from "./FamilyKey"

export type AtomFamilyOptions<
    Value = unknown,
    Args extends [any, ...any[]] = [any, ...any[]],
> = AtomOptions<Value> & {
    /** Derive deterministic cache identity from arguments the built-in family
     * key codec does not support, or intentionally group multiple arguments. */
    keyOf?: (...args: Args) => FamilyKey
}
