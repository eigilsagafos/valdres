import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"

/**
 * Is there a committed value for `state` in THIS store? The precondition every
 * equal-gated skip needs before it may treat the stored value as something to
 * compare against.
 *
 * `data.values.get()` returns `undefined` both for a committed `undefined` and
 * for NOTHING COMMITTED, so an equality check has to tell the two apart before
 * it trusts the answer. Every site that skips a write on `equal` needs the same
 * question answered, and asking it ad hoc (or not at all) has produced three
 * separate bugs: a scope's explicit set to its inherited value skipped the
 * shadow that pins it, so a later parent write leaked in (`setAtom`); a
 * selector whose value was `undefined` compared equal to nothing at all and was
 * never committed, leaving it permanently unmemoized (`initSelector`); and
 * `equal` was invoked with the absent sentinel, so an ordinary type-correct
 * comparator threw on a first read (`initSelector`, `propagateUpdatedAtoms`).
 *
 * GATE on this, never post-filter with it. `hasCommittedValue(…) && equal(…)`
 * never hands a comparator the absent sentinel; `equal(…) && hasCommittedValue(…)`
 * calls the comparator and then discards its answer, so a comparator that
 * dereferences its operands — `(a, b) => a.id === b.id`, which `EqualFunc<Value>`
 * says is legal, since it types BOTH operands as `Value` and not
 * `Value | undefined` — still throws. Gating is also what keeps every comparator
 * `treeEqualAcrossGroups` invokes per provenance group out of that position: one
 * gate covers all of them, a post-filter covers none.
 *
 * `committedValue` is the caller's already-read `data.values.get(state)` for
 * THIS `data`. Any entry that isn't `undefined` proves presence on its own, so
 * the map probe is paid only when the value we would otherwise compare against
 * is `undefined` — the hot selector path pays one compare. Pass NOTHING when
 * the value in hand did not come from this store's `values`: a scope's
 * read-through (`getState`) resolves to an inherited value, which says nothing
 * about a local entry, and passing it would claim a shadow that doesn't exist.
 *
 * The answer is only as fresh as the read. Anything that can commit between the
 * read and this call — a selector body, a write, user code in a hook — makes an
 * `undefined` in hand stale, and the probe would then report the NEW entry as
 * proof that the old absent one was present. Ask at the point the value was
 * read (`transaction.ts` captures it before its own write for exactly this
 * reason) or re-read before asking.
 */
export const hasCommittedValue = (
    state: State,
    data: StoreData,
    committedValue?: unknown,
): boolean => committedValue !== undefined || data.values.has(state)
