import type { SelectorEvaluationRuntime } from "../lib/initSelector"
import type { Atom } from "./Atom"
import type { AtomFamily } from "./AtomFamily"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { Selector } from "./Selector"

/**
 * The write overlay of one transaction level: everything a transaction stages
 * against a single store before commit, and nothing about how a commit
 * executes. A transaction context owns exactly one draft per store level;
 * commit translates the finalized draft into a `CommitPlan` (or, for the
 * unmigrated cross-scope/global shapes, into the legacy fan-out sequencing).
 *
 * The overlay layers over committed store state in read precedence order:
 * staged `values` → `unsets` tombstone (fall through to the parent chain) →
 * committed `data.values` → parent transaction. Speculative selector reads are
 * memoized in `selectorCache` and evaluated against `selectorRuntime` so an
 * aborted transaction can never rewrite the committed selector graph.
 */
export type MutationDraft = {
    /** Staged atom values, plus family-index carrier arrays for families whose
     *  membership this transaction changes. */
    values: Map<any, any>
    /** Unset tombstones: atoms whose own value is detached at commit so they
     *  revert (re-inherit on a scope, de-materialize on a root). */
    unsets: Set<Atom<any>> | undefined
    /** The subset of `unsets` staged by `unsetAll`, i.e. family members whose
     *  membership must NOT survive the revert. An ordinary `unset` keeps
     *  membership (it resets a member's value, and the settlement re-registers
     *  it); `unsetAll` is returning the scope's index to its parent's, so a
     *  member re-registered by its own unset settlement would immediately undo
     *  that. Read by the settlement's family-add bookkeeping and by
     *  `stageLazyFamilyMemberships`. */
    membershipFreeUnsets: Set<AtomFamilyAtom<any, any>> | undefined
    /** Families whose own index `unsetAll` returned to a pass-through, applied
     *  by the write phase rather than through `values` — see
     *  `applyFamilyIndexResets`. */
    familyIndexResets: Set<AtomFamily<any, [any, ...any[]]>> | undefined
    /** Family-member delete tombstones that also have a committed value to
     *  remove (membership-only deletes live in the staged family index). */
    deletes: Set<AtomFamilyAtom<any, any>> | undefined
    /** Families whose staged working index needs one render (copy + sort)
     *  before the next observation boundary: a family read or the commit. */
    dirtyFamilyIndexes: Set<AtomFamily<any, [any, ...any[]]>> | undefined
    /** Atoms lazily initialized by overlay reads during the transaction body.
     *  Distinct from the commit-scoped initialization set the write phase
     *  allocates: body-initialized atoms must not be re-propagated. */
    initializedAtoms: Set<Atom<any>> | undefined
    /** Family members from `initializedAtoms` whose membership the commit staged
     *  into the working index (set at commit, after the body has closed). The
     *  write phase hands the ones it did not itself notify to the commit's init
     *  group, so a lazy read notifies exactly like the direct read it stands in
     *  for. */
    lazyInitMembers: Atom<any>[] | undefined
    /** Families whose membership a real write (`set`, `del`, bulk set) staged.
     *  A family index that changed for any other reason changed only because a
     *  lazy read registered a member, so its settlement carries init provenance
     *  and must stay silent on `onChange` — like the direct read it stands in
     *  for. */
    writtenFamilies: Set<AtomFamily<any, [any, ...any[]]>> | undefined
    /** Overlay revision marker. Every staging operation sets it; the next
     *  overlay selector read drops `selectorCache` and clears it. */
    dirty: boolean
    /** Speculative selector-read cache (read-your-writes memoization). */
    selectorCache: Map<Selector<any>, any> | undefined
    /** Isolated evaluation bookkeeping for overlay selector reads — see
     *  `SelectorEvaluationRuntime`. */
    selectorRuntime: SelectorEvaluationRuntime | undefined
    /** Per-transaction circular-dependency guard for overlay selector reads. */
    selectorCircularDependencies: WeakSet<any> | undefined
    /** True once any staged atom carries an onSet hook (global atoms always
     *  do), selecting the phased hook/fan-out commit path. */
    hasCommitEffects: boolean
}
