import type { AtomFamily } from "./AtomFamily"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { GlobalAtom } from "./GlobalAtom"

/** The return type of `atomFamily(defaultValue, { global: true })`.
 *
 *  Identical to `AtomFamily` except that members carry the global atom surface
 *  (`getSelf`/`setSelf`/`resetSelf`) alongside their family identity. `Omit<…,
 *  never>` keeps the family's own properties while dropping the base call
 *  signature, so the narrowed one below is the only way to construct a member —
 *  otherwise both signatures would be in scope and overload resolution could
 *  pick the non-global one. */
export type GlobalAtomFamily<
    Value,
    Args extends [any, ...any[]] = [any, ...any[]],
> = Omit<AtomFamily<Value, Args>, never> & {
    (...args: Args): AtomFamilyAtom<Value, Args> & GlobalAtom<Value>
}
