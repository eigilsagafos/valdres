import type { InternalAtom } from "./InternalAtom"
import type { InternalAtomFamily } from "./InternalAtomFamily"
import type { InternalSelector } from "./InternalSelector"

/** Engine view of public State values at runtime boundaries. */
export type InternalState<
    Value extends any = any,
    Args extends [any, ...any[]] = [any, ...any[]],
> =
    | InternalAtom<Value>
    | InternalSelector<Value>
    | InternalAtomFamily<Value, Args>
