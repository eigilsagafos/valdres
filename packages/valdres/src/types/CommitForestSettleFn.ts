import type { CommitErrors } from "../lib/commitErrors"
import type { StoreAtomUpdates } from "../lib/globalAtomFanOut"
import type { ChangeReport } from "../lib/notifyChangeListeners"
import type { Atom } from "./Atom"
import type { AtomFamily } from "./AtomFamily"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { NonEmpty } from "./NonEmpty"
import type { StoreChangeSource } from "./StoreChangeSource"
import type { StoreData } from "./StoreData"

/** One store's finalized local slot in a multi-root commit forest. Global peer
 * updates are folded into the canonical node for the same StoreData by the
 * forest settlement before any graph work begins.
 *
 * `updatedAtoms` is always an array — the write phase's own result, empty when
 * every write turned out value-equal. The cleanup groups are `NonEmpty` or
 * absent, so "this store has delete/unset work" is one `!== undefined` test for
 * both, instead of the per-group emptiness convention that made an empty
 * `deleted` count as work while an empty `unsetAtoms` did not. */
export type CommitForestEntry = {
    data: StoreData
    updatedAtoms: Atom<any>[]
    deleted: NonEmpty<AtomFamilyAtom<any, any>> | undefined
    unsetAtoms: NonEmpty<Atom<any>> | undefined
    /** Members of `unsetAtoms` that must NOT be re-registered in this store's
     * family index by their own settlement — `unsetAll` reverting a scope's
     * index to its parent's. Absent for every ordinary unset, which keeps
     * membership. Optional (unlike the group arrays): it modifies `unsetAtoms`
     * rather than declaring work of its own, so a plan that has no opinion omits
     * it. The engine's own entry literals still set it explicitly, keeping one
     * object shape across every commit. */
    unsetMembershipDrops?: Set<AtomFamilyAtom<any, any>> | undefined
    /** Members whose atom-family membership changed because `unsetAll` reverted
     * this store's family index, and that no other group in the commit carries.
     * In practice that is the members coming BACK — a scope-local `del` being
     * undone — which have no value write anywhere (their value lives in the
     * parent), so this is the only channel that can notify their family's
     * subscribers and report them. Members that LEFT are excluded: the revert
     * unset their values, so the unset group already carries them, and emitting
     * them here too would report each one twice. Optional for the same reason as
     * `unsetMembershipDrops`. */
    familyMemberDelta?:
        | Map<AtomFamily<any>, Set<AtomFamilyAtom<any, any>>>
        | undefined
    /** Families whose index `unsetAll` reverted in this store. Their
     * subscriptions stopped delegating to the parent when the scope first
     * shadowed the family; the reverted index is a pass-through, so the
     * settlement re-arms the delegate after firing — the family counterpart of
     * re-delegating `unsetAtoms`. */
    familyIndexReverts?: NonEmpty<AtomFamily<any>> | undefined
    /** Family members a transaction body lazily INITIALIZED — their values
     * landed during the body read, so no write carries them, but the store must
     * still register their membership and notify their subscribers exactly as a
     * direct lazy read does. Settled in the commit's own notification phase (so
     * subscribers precede onChange and the engine's error continuation applies)
     * but deliberately reported to NOTHING: a lazy read is not a change. */
    initAtoms: NonEmpty<Atom<any>> | undefined
    children: CommitForestEntry[] | undefined
}

/** Settle a logical commit spanning one or more independent store trees. Every
 * physical StoreData is canonicalized to one sparse-forest node and visited
 * once with the union of local, inherited, and global trigger groups. */
export type CommitForestSettleFn = (
    entries: CommitForestEntry[],
    globalUpdates: StoreAtomUpdates | undefined,
    globalSource: StoreChangeSource | undefined,
    report: ChangeReport | undefined,
    errors: CommitErrors,
) => void
