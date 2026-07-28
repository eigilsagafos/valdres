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
import {
    clearStaleSelectorActivation,
} from "./graph"
import { hasAtomCommitObservers } from "./hasAtomCommitObservers"
import { initAtom } from "./initAtom"
import { initSelector } from "./initSelector"
import { settleCommit } from "./propagateUpdatedAtoms"
import { resolveAtomDefaultValue } from "./resolveAtomDefaultValue"
import { setValueInData } from "./setValueInData"
import { getStateRevision, noteStateValueChanged } from "./stateRevisions"
import { isStoreDisposed } from "./storeLifecycle"
import { validateResolvedValue } from "./validateResolvedValue"
import { validateSchema } from "./validateSchema"
import { createAtomFamilyIndex, renderAtomFamilyIndex } from "./atomFamilyIndex"

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
            runCommitPlan({
                data,
                settlement: {
                    kind: "update",
                    atoms: [state],
                    settle: settleCommit,
                    flags: SETTLE_SKIP_FAMILY_INDEX,
                },
                admit: () =>
                    admitDeletedMemberDefaultTransition(
                        state,
                        resolvedValue,
                        cached,
                        data,
                        undefined,
                        undefined,
                    ),
                apply: () =>
                    applyDeletedMemberDefaultResolution(
                        state,
                        resolvedValue,
                        cached,
                        data,
                        undefined,
                        undefined,
                    ),
                onSets: [],
                errors: createCommitErrors(),
                report: undefined,
            })
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

const isColdSelectorCacheFresh = (
    selector: Selector,
    cache: ColdSelectorCache,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet?: WeakSet<Selector>,
): boolean => {
    if (cache.validatedAt === data.stateRevisionClock.current) return true
    // Negative snapshots are deliberately non-validatable: either a late async
    // read changed the dependency set before its revision array was rebuilt, or
    // the evaluation observed a dependency revision that is no longer current.
    if (cache.validatedAt < 0) return false

    const dependencies = cache.dependencies
    if (dependencies.length !== cache.dependencyRevisions.length) return false

    // A dependency set containing no selectors cannot recurse back into this
    // cache. This is the overwhelmingly common shape (a derived value reading
    // one or a few atoms), so validate it without three WeakSet operations and
    // without looking the dependency Set up again in stateDependencies.
    if (!cache.hasSelectorDependencies) {
        for (let index = 0; index < dependencies.length; index++) {
            const dependency = dependencies[index]
            if (
                getStateRevision(dependency, data) !==
                cache.dependencyRevisions[index]
            ) {
                return false
            }
        }
        cache.validatedAt = data.stateRevisionClock.current
        return true
    }

    // Cached async/dynamic selector graphs can be cyclic. Treat a cache already
    // being validated as provisionally fresh; the outer walk still compares its
    // state revision and every reachable non-cyclic source revision.
    if (data.coldCacheValidationSet.has(selector)) return true
    data.coldCacheValidationSet.add(selector)
    try {
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
        // shared clock. This snapshot is current through the end of that walk.
        cache.validatedAt = data.stateRevisionClock.current
        return true
    } finally {
        data.coldCacheValidationSet.delete(selector)
    }
}

/** Validate a cache entry already resolved by the caller while retaining the
 * normal recursive selector-validation path. */
const getColdSelectorState = <Value>(
    selector: Selector<Value>,
    cache: ColdSelectorCache,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet?: WeakSet<Selector>,
): Value => {
    if (
        !isColdSelectorCacheFresh(
            selector,
            cache,
            data,
            initializedAtomsSet,
            circularDependencySet,
        )
    ) {
        initSelector(selector, data, initializedAtomsSet, circularDependencySet)
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
        // Atom-only stores retain the original has/get fast path. Once this
        // store has materialized any cold selector, only a state with matching
        // metadata needs validation; active selectors have no such entry.
        const coldCache = data.coldSelectorCachesEnabled
            ? data.coldSelectorCaches.get(state)
            : undefined
        if (!coldCache) {
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
    throw new Error("Invalid object passed to get")
}

const findClosestStoreWithAtomInitialized = (
    atom: Atom | AtomFamily<any, any>,
    data: StoreData,
): StoreData => {
    if (!data.parent) return data
    if (data.values.has(atom)) return data
    return findClosestStoreWithAtomInitialized(atom, data.parent)
}

const isAtomDeletedInFamilyIndex = (atom: any, index: any): boolean => {
    if (index.deleted.has(atom)) return true
    if (index.created.has(atom)) return false
    if (index.parentIndex)
        return isAtomDeletedInFamilyIndex(atom, index.parentIndex)
    return false
}
