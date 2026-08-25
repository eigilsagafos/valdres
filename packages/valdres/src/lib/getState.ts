import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { Selector } from "../types/Selector"
import type { State } from "../types/State"
import type { ColdSelectorCache, StoreData } from "../types/StoreData"
import { isAtom } from "../utils/isAtom"
import { isAtomFamily } from "../utils/isAtomFamily"
import { isPromiseLike } from "../utils/isPromiseLike"
import { isFamilyAtom } from "../utils/isFamilyAtom"
import { isSelector } from "../utils/isSelector"
import { createScalarCommit, runCommitPlan } from "./commitEngine"
import { createCommitErrors } from "./commitErrors"
import { SETTLE_SKIP_FAMILY_INDEX } from "./commitIntents"
import { createCommitPlan, NO_ON_SETS, updateSettlement } from "./commitPlans"
import { clearStaleSelectorActivation } from "./graph"
import { hasAtomCommitObservers } from "./hasAtomCommitObservers"
import { initAtom } from "./initAtom"
import { initSelector } from "./initSelector"
import { settleCommit } from "./propagateUpdatedAtoms"
import { resolveAtomDefaultValue } from "./resolveAtomDefaultValue"
import { setValueInData } from "./setValueInData"
import { getStateRevision, noteStateValueChanged } from "./stateRevisions"
import { stateNameSuffix } from "./stateNameForError"
import { IS_PROD } from "./IS_PROD"
import { isStoreDisposed } from "./storeLifecycle"
import {
    coldCacheIsCurrentInPass,
    coldValidationMayRecord,
} from "./storeTreeRuntime"
import { validateResolvedValue } from "./validateResolvedValue"
import { validateSchema } from "./validateSchema"
import {
    createAtomFamilyIndex,
    renderAtomFamilyIndex,
    renderDirtyFamilyIndex,
} from "./atomFamilyIndex"

const admitDeletedMemberDefaultTransition = <Value>(
    state: AtomFamilyAtom<Value, any>,
    _resolvedValue: Value | undefined,
    promise: PromiseLike<Value>,
    data: StoreData,
    _unused1: undefined,
    _unused2: undefined,
): boolean => !isStoreDisposed(data) && data.values.get(state) === promise

const applyDeletedMemberDefaultResolution = <Value>(
    state: AtomFamilyAtom<Value, any>,
    resolvedValue: Value,
    _promise: PromiseLike<Value>,
    data: StoreData,
    _unused1: undefined,
    _unused2: undefined,
) => {
    setValueInData(state, resolvedValue, data)
}

const applyDeletedMemberDefaultCleanup = <Value>(
    state: AtomFamilyAtom<Value, any>,
    _resolvedValue: Value | undefined,
    _promise: PromiseLike<Value>,
    data: StoreData,
    _unused1: undefined,
    _unused2: undefined,
) => {
    data.values.delete(state)
    noteStateValueChanged(state, data)
}

const commitDeletedMemberDefaultResolution = createScalarCommit(
    applyDeletedMemberDefaultResolution,
)
const commitDeletedMemberDefaultCleanup = createScalarCommit(
    applyDeletedMemberDefaultCleanup,
)

/** Attach the cold async-deleted-member settlement outside getState itself.
 * Keeping these reaction closures out of the read primitive preserves V8's
 * optimization tier for transaction loops that call getState thousands of
 * times without ever entering this branch. */
const coordinateDeletedMemberDefault = <Value>(
    state: AtomFamilyAtom<Value, any>,
    cached: PromiseLike<Value>,
    data: StoreData,
) => {
    cached.then(
        resolvedValue => {
            if (data.values.get(state) !== cached) return
            if (!validateResolvedValue(state, resolvedValue, data)) {
                // Invalid: failure reported; drop so a later read re-inits
                // rather than committing it.
                commitDeletedMemberDefaultCleanup(
                    admitDeletedMemberDefaultTransition(
                        state,
                        resolvedValue,
                        cached,
                        data,
                        undefined,
                        undefined,
                    ),
                    state,
                    resolvedValue,
                    cached,
                    data,
                    undefined,
                    undefined,
                )
                return
            }
            const admitted = admitDeletedMemberDefaultTransition(
                state,
                resolvedValue,
                cached,
                data,
                undefined,
                undefined,
            )
            if (!hasAtomCommitObservers(state, data)) {
                commitDeletedMemberDefaultResolution(
                    admitted,
                    state,
                    resolvedValue,
                    cached,
                    data,
                    undefined,
                    undefined,
                )
                return
            }
            runCommitPlan(
                createCommitPlan(
                    data,
                    updateSettlement(
                        data,
                        [state],
                        settleCommit,
                        SETTLE_SKIP_FAMILY_INDEX,
                    ),
                    NO_ON_SETS,
                    createCommitErrors(),
                    undefined,
                    undefined,
                    () =>
                        admitDeletedMemberDefaultTransition(
                            state,
                            resolvedValue,
                            cached,
                            data,
                            undefined,
                            undefined,
                        ),
                    () =>
                        applyDeletedMemberDefaultResolution(
                            state,
                            resolvedValue,
                            cached,
                            data,
                            undefined,
                            undefined,
                        ),
                ),
            )
        },
        () => {
            commitDeletedMemberDefaultCleanup(
                admitDeletedMemberDefaultTransition(
                    state,
                    undefined,
                    cached,
                    data,
                    undefined,
                    undefined,
                ),
                state,
                undefined,
                cached,
                data,
                undefined,
                undefined,
            )
        },
    )
}

/**
 * Is this cold snapshot still consistent with what its dependencies hold now?
 *
 * THE VALIDATION PASS, and why `validatedAt` alone was not enough of a memo.
 * This is the canonical explanation; the fields it describes
 * (`ColdSelectorCache.validatedInPass`, `StoreTreeRuntime.coldValidation*`)
 * point here rather than repeating it.
 *
 * `validatedAt` records the tree-wide revision clock at the moment a snapshot
 * was proven current, and `validatedAt === tree.revision` is the O(1) "nothing
 * anywhere has changed since" shortcut. The problem is that a validation walk
 * ADVANCES that clock itself: reaching a stale selector dependency re-evaluates
 * it, and committing the new value bumps the revision. So the first
 * re-evaluation inside a walk aged the stamp of every sibling snapshot the same
 * walk had already validated, and each of those then re-walked its entire
 * dependency closure — repeatedly, once per re-evaluation. The shortcut hit
 * ZERO times during a load. On a deep, shared graph under write churn the cost
 * was superlinear in graph size: a wide fan-in layer was re-validated once per
 * dependent above it, and a real app measured 102,241 revision comparisons for
 * a single write-then-read over a graph with 7,020 edges.
 *
 * The pass id fixes it by being a clock that does NOT tick for the walk's own
 * materializations. A snapshot stamped in the pass still in flight is current by
 * construction: a selector's value is a pure function of its dependencies, so
 * anything the walk re-derived cannot have changed what an earlier-validated
 * snapshot observed. The pass also survives BETWEEN top-level reads — it ends
 * only when the clock moves while no pass is in flight — so a burst of reads
 * over one cold graph (React calling getSnapshot for every mounted component)
 * validates each snapshot at most once in total rather than once per root.
 *
 * The premise has two holes, both closed rather than assumed away. A revision
 * advancing for something the walk did NOT derive — user code re-entering the
 * store and writing from a selector body, an atom default resolving, an async
 * settlement — ends the pass on the spot (`endColdValidationPass`). And a
 * freshness answer that came from the cycle guard is a GUESS, not a proof, so a
 * pass that used one is retired when it ends rather than carried into the next
 * read (see the guard below).
 */
/** Count the comparisons one validation is about to make. Per validation, not
 * per comparison, so the loop stays a plain indexed compare — a mid-loop
 * bail-out over-counts, the safe direction for an upper-bound gate. */
const recordColdCacheDependencyChecks = (data: StoreData, count: number) => {
    const instrumentation = data.architectureInstrumentation
    if (instrumentation)
        instrumentation.counters.coldCacheDependencyChecks += count
}

const isColdSelectorCacheFresh = (
    selector: Selector,
    cache: ColdSelectorCache,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet?: WeakSet<Selector>,
): boolean => {
    const tree = data.tree
    if (cache.validatedAt === tree.revision) return true
    // Negative snapshots are deliberately non-validatable: either a late async
    // read changed the dependency set before its revision array was rebuilt, or
    // the evaluation observed a dependency revision that is no longer current.
    // Checked BEFORE the pass memo so an invalidation can never be memoed away.
    if (cache.validatedAt < 0) return false
    // Already proven current in the pass still in flight: `validatedAt` has
    // merely aged behind a materialization this same walk performed. Only ever
    // reached from inside a pass (getColdSelectorState holds the depth), so the
    // pass needs no separate currency check here.
    if (cache.validatedInPass === tree.coldValidationPass) return true

    const dependencies = cache.dependencies
    if (dependencies.length !== cache.dependencyRevisions.length) return false

    // A dependency set containing no selectors cannot recurse back into this
    // cache. This is the overwhelmingly common shape (a derived value reading
    // one or a few atoms), so validate it without three WeakSet operations and
    // without looking the dependency Set up again in stateDependencies.
    if (!cache.hasSelectorDependencies) {
        if (!IS_PROD) recordColdCacheDependencyChecks(data, dependencies.length)
        for (let index = 0; index < dependencies.length; index++) {
            const dependency = dependencies[index]
            if (
                getStateRevision(dependency, data) !==
                cache.dependencyRevisions[index]
            ) {
                return false
            }
        }
        if (coldValidationMayRecord(tree)) {
            cache.validatedAt = tree.revision
            cache.validatedInPass = tree.coldValidationPass
        }
        return true
    }

    // Cached async/dynamic selector graphs can be cyclic. Treat a cache already
    // being validated as provisionally fresh; the outer walk still compares its
    // state revision and every reachable non-cyclic source revision.
    //
    // This answer is a GUESS, and it must not outlive the read that made it. It
    // was only ever self-correcting by accident: the walk kept advancing the
    // clock, so an outer snapshot that leaned on the guess had its `validatedAt`
    // aged before the next read and got re-walked. A pass stamp does not age, so
    // letting one survive freezes the guess — a dependency set that turns cyclic
    // dynamically (a branch flipping to read its own dependent) reported
    // SelectorCircularDependencyError once and then served two values that
    // contradicted each other, forever.
    //
    // So count the guess, and retire the whole pass when it ends (see the exit in
    // getColdSelectorState). The within-read memo still applies, which is what
    // keeps a cyclic graph from being quadratic; only the CROSS-read memo is
    // given up, which is exactly the guarantee a guess cannot support. Cyclic
    // cold graphs therefore keep the pre-pass behaviour — the cycle is reported
    // on every read and no snapshot freezes — and acyclic graphs, where the whole
    // performance problem lives, pay nothing.
    if (data.coldCacheValidationSet.has(selector)) {
        tree.coldValidationProvisional++
        return true
    }
    data.coldCacheValidationSet.add(selector)
    try {
        if (!IS_PROD) recordColdCacheDependencyChecks(data, dependencies.length)
        for (let index = 0; index < dependencies.length; index++) {
            const dependency = dependencies[index]
            if (isSelector(dependency)) {
                getState(
                    dependency,
                    data,
                    initializedAtomsSet,
                    circularDependencySet,
                )
            }
            if (
                getStateRevision(dependency, data) !==
                cache.dependencyRevisions[index]
            ) {
                return false
            }
        }
        // Dependency validation can itself materialize values and advance the
        // shared clock. This snapshot is current through the end of that walk —
        // UNLESS the walk's evidence was voided while it ran, in which case it
        // records nothing at all, not even `validatedAt`. See
        // `coldValidationMayRecord` for the two ways that happens and what each
        // one broke.
        if (coldValidationMayRecord(tree)) {
            cache.validatedAt = tree.revision
            cache.validatedInPass = tree.coldValidationPass
        }
        return true
    } finally {
        data.coldCacheValidationSet.delete(selector)
    }
}

/** Validate a cache entry already resolved by the caller while retaining the
 * normal recursive selector-validation path. Owns the validation pass — see
 * `isColdSelectorCacheFresh` for what the pass is for. */
const getColdSelectorState = <Value>(
    selector: Selector<Value>,
    cache: ColdSelectorCache,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet?: WeakSet<Selector>,
): Value => {
    const tree = data.tree
    // Snapshot already proven current in the pass in flight (or in the last one,
    // with nothing changed since it ended). This is the dominant shape for a
    // read burst over a shared cold graph, and it deliberately skips the pass
    // bookkeeping below: paying that per cached dependency read is the cost this
    // memo exists to remove.
    if (coldCacheIsCurrentInPass(cache, tree)) {
        return data.values.get(selector)
    }
    if (
        tree.coldValidationDepth === 0 &&
        tree.coldValidationBaseRevision !== tree.revision
    ) {
        tree.coldValidationPass++
    }
    if (tree.coldValidationDepth === 0) {
        tree.coldValidationProvisional = 0
        tree.coldValidationPoisoned = false
    }
    tree.coldValidationDepth++
    try {
        // Re-evaluation stays INSIDE the pass. Running it outside would advance
        // the clock and then re-open a fresh pass for each dependency the
        // re-evaluation reads, discarding the memo exactly where it pays most.
        if (
            !isColdSelectorCacheFresh(
                selector,
                cache,
                data,
                initializedAtomsSet,
                circularDependencySet,
            )
        ) {
            initSelector(
                selector,
                data,
                initializedAtomsSet,
                circularDependencySet,
            )
        }
    } finally {
        if (--tree.coldValidationDepth === 0) {
            tree.coldValidationBaseRevision = tree.revision
            // A walk whose evidence was voided recorded nothing, but records it
            // wrote BEFORE that happened are still live — retire the id so a
            // later read cannot believe them.
            if (
                tree.coldValidationProvisional !== 0 ||
                tree.coldValidationPoisoned
            ) {
                tree.coldValidationProvisional = 0
                tree.coldValidationPoisoned = false
                tree.coldValidationPass++
            }
        }
    }
    return data.values.get(selector)
}

export function getState<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    atom: Atom<Value>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet?: WeakSet<Selector>,
): Value

export function getState<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    selector: Selector<Value>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet?: WeakSet<Selector>,
): Value

export function getState<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    family: AtomFamily<Value, Args>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet?: WeakSet<Selector>,
): readonly AtomFamilyAtom<Value, Args>[]

export function getState<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    state: State<Value, Args>,
    data: StoreData,
    initializedAtomsSet: Set<Atom<any>>,
    circularDependencySet?: WeakSet<Selector>,
) {
    if (data.values.has(state)) {
        // Observation boundary for a family whose membership changed since the
        // last read: the write left the snapshot unrendered, so materialize it
        // here. One field load until this store touches a family's membership.
        if (
            data.dirtyFamilyIndexes !== undefined &&
            data.dirtyFamilyIndexes.has(state as AtomFamily<any, any>)
        ) {
            return renderDirtyFamilyIndex(state as AtomFamily<any, any>, data)
        }
        // Atom-only stores retain the original has/get fast path. Once this
        // store has materialized any cold selector, only a state with matching
        // metadata needs validation; active selectors have no such entry.
        const coldCache = data.coldSelectorCachesEnabled
            ? data.coldSelectorCaches.get(state)
            : undefined
        // Hoist isColdSelectorCacheFresh's own first test. Nothing this cache
        // observed has changed since it was last validated, so the two calls it
        // would take to reach the same `data.values.get` are pure overhead — and
        // read-heavy traversals take this branch on nearly every read. Mirrors
        // the identical check at the store boundary in storeFromStoreData.
        if (!coldCache || coldCache.validatedAt === data.tree.revision) {
            return data.values.get(state)
        }
        return getColdSelectorState(
            state as Selector,
            coldCache,
            data,
            initializedAtomsSet,
            circularDependencySet,
        )
    }
    if (isAtom<Value>(state)) {
        if (data.parent)
            return getState<Value, Args>(
                state,
                data.parent,
                initializedAtomsSet,
                circularDependencySet,
            )
        if (isFamilyAtom(state)) {
            const familyValue = data.values.get(state.family)
            if (familyValue?.__index) {
                if (isAtomDeletedInFamilyIndex(state, familyValue.__index)) {
                    // Resolve the default once and cache it so repeated reads
                    // are stable (same reference) and never re-invoke a
                    // function/async default factory — re-running it on every
                    // read would repeat its side effects (e.g. a fetch). We
                    // deliberately DON'T add `state` to initializedAtomsSet, so
                    // the get-time propagation that re-registers a member in the
                    // family index never runs: the member stays deleted (absent
                    // from get(family)); only its direct read is memoized.
                    const value = resolveAtomDefaultValue(
                        state,
                        data,
                        initializedAtomsSet,
                    )
                    // Validate the deleted-member default like any other
                    // boundary: sync values throw here; the async value is
                    // validated on resolve below.
                    if (!isPromiseLike(value))
                        validateSchema(state, value, data)
                    const cached = setValueInData(state, value, data)
                    // Async default: mirror getAtomInitValue and swap the cached
                    // promise for its resolved value once it settles, so later
                    // reads return the value rather than a forever-pending
                    // promise. Stale-guard against a concurrent re-set/re-delete,
                    // and drop the entry on rejection. Propagate with
                    // skipFamilyIndexUpdate so dependent selectors/subscribers see
                    // the resolved value WITHOUT re-registering (resurrecting) the
                    // deleted member in the family index.
                    if (isPromiseLike(cached))
                        coordinateDeletedMemberDefault(state, cached, data)
                    return cached as Value
                }
            }
        }
        initAtom<Value, Args>(state, data, initializedAtomsSet)
        initializedAtomsSet.add(state)
        return data.values.get(state)
    }
    if (isSelector<Value>(state)) {
        // Fresh live subscriptions bypass this path and call
        // initFreshActiveSelector directly; a graph-less read must first shed
        // any stale active marker left behind by cheap orphan teardown. The
        // presence CHECK is a plain read (unrestricted); only the rare stale
        // path crosses into the graph runtime to write.
        if (!data.stateDependencies.has(state)) {
            clearStaleSelectorActivation(state, data)
        }
        initSelector<Value>(
            state,
            data,
            initializedAtomsSet,
            circularDependencySet,
        )
        return data.values.get(state)
    }
    if (isAtomFamily<Value, Args>(state)) {
        if (data.parent) {
            const closestData = findClosestStoreWithAtomInitialized(state, data)
            return getState<Value, Args>(
                state,
                closestData,
                initializedAtomsSet,
                circularDependencySet,
            )
        }
        data.values.set(state, renderAtomFamilyIndex(createAtomFamilyIndex()))
        // Family indexes bypass setValueInData because their mutable internal
        // bookkeeping must not be deep-frozen.
        noteStateValueChanged(state, data)
        initializedAtomsSet.add(state)
        return data.values.get(state)
    }
    throw new Error(
        `valdres: invalid object${stateNameSuffix(state)} passed to get()`,
    )
}

const findClosestStoreWithAtomInitialized = (
    atom: Atom | AtomFamily<any, any>,
    data: StoreData,
): StoreData => {
    if (!data.parent) return data
    if (data.values.has(atom)) return data
    return findClosestStoreWithAtomInitialized(atom, data.parent)
}

/** True when `atom` carries a delete tombstone in `index` or, failing an
 *  explicit local record either way, in any ancestor index it inherits from.
 *  This — not a local cleanup set or the presence of a value somewhere up the
 *  parent chain — is the authority on whether a family member is deleted: a
 *  scope's `del` of an INHERITED member writes only a tombstone (there is no
 *  local value to remove), and its value goes on living in the ancestor. */
export const isAtomDeletedInFamilyIndex = (atom: any, index: any): boolean => {
    if (index.deleted.has(atom)) return true
    if (index.created.has(atom)) return false
    if (index.parentIndex)
        return isAtomDeletedInFamilyIndex(atom, index.parentIndex)
    return false
}
