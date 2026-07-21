/**
 * The three behavioral mode flags of a settle pass (phases 4–7 of a commit:
 * settle selectors → deliver subscribers → flush onChange → commit boundary).
 * Typed replacement for the trailing positional booleans of the historical
 * `propagateAtomUpdate` signature. Always passed as one of the shared frozen
 * singletons in `lib/commitIntents` — never allocated per call — so the settle
 * entry stays monomorphic on a single hidden class.
 *
 * `notify` and `report` are deliberately NOT part of this type: they are
 * per-call data (a live NotifyTarget map, a source tag or buffering sink), not
 * mode flags, and remain positional parameters of `settleCommit`.
 */
export type SettleFlags = {
    /** Initialization-only settle: propagate lazily-materialized values without
     *  observer reporting. */
    readonly isInitOnly: boolean
    /** Propagate family-atom members to their dependent selectors/subscribers
     *  WITHOUT registering them in the family index. Used by the deleted-member
     *  async-default swap (see getState): the resolved value must reach
     *  dependents, but re-adding the member would resurrect a deleted member. */
    readonly skipFamilyIndexUpdate: boolean
    /** false = report only the recomputed selectors to onChange; the caller
     *  reports the trigger atoms itself (the `unset` path emits them as
     *  `kind: "unset"`, so they must not also surface as a `"set"`). */
    readonly reportAtoms: boolean
}
