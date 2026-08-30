import type { Selector } from "../../src/types/Selector"
import type { State } from "../../src/types/State"
import type { Store } from "../../src/types/Store"
import type { ColdSelectorCache, StoreData } from "../../src/types/StoreData"
import { getStoreData } from "../../src/lib/getStoreData"
import { isStoreDisposed, peekStoreResources } from "../../src/lib/storeLifecycle"
import { isAtomFamily } from "../../src/utils/isAtomFamily"
import { isAtom } from "../../src/utils/isAtom"
import { isFamilyAtom } from "../../src/utils/isFamilyAtom"
import { isSelector } from "../../src/utils/isSelector"

/**
 * TEST-ONLY runtime invariant checker for the Valdres core store.
 *
 * This module is imported exclusively from `*.test.ts` files. It never sits on
 * a production import path (see test/import-cycles/importCycles.test.ts, which
 * scans only `src/`), so it adds zero production overhead and can freely read
 * internal `StoreData` structures that production keeps opaque.
 *
 * It intentionally does NOT enumerate any WeakMap. Instead it discovers the
 * live "region" of states from the iterable anchors the store already keeps —
 * subscribed states, the mount ledger, scope branch keys — plus any states a
 * caller passes explicitly, then walks the (symmetric) dependency graph by key
 * lookups exactly as production code does. So the checker mirrors real access
 * patterns and can run inside fuzzers without changing what it observes.
 *
 * Invariant categories (each can be independently corrupted; see the colocated
 * checkStoreInvariants.test.ts fixtures):
 *   - symmetric-edges       forward/reverse dependency edges agree
 *   - dependency-ownership  materialization order + scope branch/value indexes
 *   - liveness-counts       liveDependentCount nonnegative and == ground truth
 *   - mount-state           mounts and mountInClosure agree with reachability
 *   - resource-balance      abort controllers / subscriptions / mount ledger
 *   - disposed-terminal     a disposed store holds no live registrations
 *   - retained-registration nothing survives that should have been released
 */
export type InvariantCategory =
    | "symmetric-edges"
    | "dependency-ownership"
    | "liveness-counts"
    | "mount-state"
    | "resource-balance"
    | "disposed-terminal"
    | "retained-registration"

export type CheckOptions = {
    /** Extra states to seed region discovery with and to audit for retained
     *  registrations in `quiescent` mode. Pass the atoms/selectors a test
     *  created so orphan leaks after teardown are caught even once the graph
     *  has disconnected them from every anchor. */
    states?: State[]
    /** Enable the post-teardown checks that only hold once every microtask-
     *  batched orphan sweep has drained (flush with `await Promise.resolve()`
     *  or the store's own public op). Off by default so mid-churn asserts don't
     *  see transient, legitimately-uncleaned graph. */
    quiescent?: boolean
    /** Categories to skip (useful when a test deliberately leaves one aspect in
     *  a known-transient state). */
    skip?: InvariantCategory[]
}

const hasOwn = <T = any>(data: any, key: string): T | undefined =>
    Object.hasOwn(data, key) ? (data[key] as T) : undefined

const hasOwnMount = (state: State): boolean =>
    !!((state as any).__valdresOnMount || (state as any).onMount)

/** Only atoms and atom families cross a scope boundary as inherited deps. */
const isInheritedState = (state: State) => isAtom(state) || isAtomFamily(state)

const label = (state: State): string => {
    const name = (state as any).name
    return name ? String(name).slice(0, 40) : "<anon>"
}

const subsSize = (data: StoreData, state: State): number => {
    const subs = hasOwn<Map<State, Set<any>> | WeakMap<State, Set<any>>>(
        data,
        "subscriptions",
    )
    return subs ? (subs.get(state)?.size ?? 0) : 0
}

const depsOf = (data: StoreData, state: State): Set<State> | undefined => {
    const map = hasOwn<WeakMap<State, Set<State>>>(data, "stateDependencies")
    return map?.get(state)
}

const dependentsOf = (data: StoreData, state: State): Set<State> | undefined => {
    const map = hasOwn<WeakMap<State, Set<State>>>(data, "stateDependents")
    return map?.get(state)
}

const coldCacheOf = (
    data: StoreData,
    selector: Selector,
): ColdSelectorCache | undefined => {
    const map = hasOwn<WeakMap<WeakKey, ColdSelectorCache>>(
        data,
        "coldSelectorCaches",
    )
    return map?.get(selector)
}

const collectTree = (root: StoreData): StoreData[] => {
    const tree = [root]
    for (let i = 0; i < tree.length; i++) {
        for (const child of tree[i]!.scopes.values()) tree.push(child)
    }
    return tree
}

/** Discover the connected region of states for one store from its iterable
 *  anchors, closed under BOTH dependency directions. */
const collectRegion = (data: StoreData, extra: State[]): Set<State> => {
    const region = new Set<State>()
    const stack: State[] = []
    const seed = (s: State | undefined) => {
        if (s && !region.has(s)) {
            region.add(s)
            stack.push(s)
        }
    }
    const equalCheck = hasOwn<Map<State, unknown>>(
        data,
        "subscriptionsRequireEqualCheck",
    )
    if (equalCheck) for (const s of equalCheck.keys()) seed(s)
    const resources = peekStoreResources(data)
    if (resources?.mounts) for (const s of resources.mounts) seed(s)
    const inheritedKeys = data.inheritedDependencyKeys
    if (inheritedKeys) for (const s of inheritedKeys) seed(s as State)
    const scopeKeys = data.scopeIndexKeys
    if (scopeKeys) for (const s of scopeKeys) seed(s as State)
    for (const s of extra) seed(s)

    while (stack.length > 0) {
        const s = stack.pop()!
        const deps = depsOf(data, s)
        if (deps) for (const d of deps) seed(d)
        const dependents = dependentsOf(data, s)
        if (dependents) for (const t of dependents) seed(t)
    }
    return region
}

/** Ground-truth liveness: direct subscribers, propagated DOWN through
 *  dependencies (a live state keeps its dependencies live). Computed from the
 *  subscription table and graph alone — never from liveDependentCount, which is
 *  what we are validating against it. */
const groundTruthLive = (data: StoreData, region: Set<State>): Set<State> => {
    const live = new Set<State>()
    const work: State[] = []
    for (const s of region) {
        if (subsSize(data, s) > 0) {
            live.add(s)
            work.push(s)
        }
    }
    while (work.length > 0) {
        const t = work.pop()!
        const deps = depsOf(data, t)
        if (!deps) continue
        for (const d of deps) {
            if (region.has(d) && !live.has(d)) {
                live.add(d)
                work.push(d)
            }
        }
    }
    return live
}

const hasHookedStrictDescendant = (data: StoreData, state: State): boolean => {
    const seen = new Set<State>([state])
    const stack: State[] = []
    const deps = depsOf(data, state)
    if (deps) for (const d of deps) stack.push(d)
    while (stack.length > 0) {
        const current = stack.pop()!
        if (seen.has(current)) continue
        seen.add(current)
        if (hasOwnMount(current)) return true
        const childDeps = depsOf(data, current)
        if (childDeps) for (const d of childDeps) if (!seen.has(d)) stack.push(d)
    }
    return false
}

const checkStore = (
    data: StoreData,
    region: Set<State>,
    explicit: State[],
    opts: CheckOptions,
    push: (category: InvariantCategory, message: string) => void,
) => {
    const disposed = isStoreDisposed(data)
    const resources = peekStoreResources(data)
    const equalCheck = hasOwn<Map<State, unknown>>(
        data,
        "subscriptionsRequireEqualCheck",
    )
    const liveCounts = hasOwn<WeakMap<State, number>>(data, "liveDependentCount")
    const mounts = hasOwn<WeakMap<State, unknown>>(data, "mounts")
    const mountInClosure = hasOwn<WeakMap<State, true>>(data, "mountInClosure")
    const dependencyOrder = hasOwn<WeakMap<State, number>>(
        data,
        "dependencyOrder",
    )
    const abortControllers = hasOwn<WeakMap<State, AbortController>>(
        data,
        "abortControllers",
    )
    const at = `store ${data.id}`

    // --- disposed-terminal ------------------------------------------------
    if (disposed) {
        if (data.scopes.size !== 0) {
            push(
                "disposed-terminal",
                `${at}: disposed store still has ${data.scopes.size} scope(s)`,
            )
        }
        if (equalCheck && equalCheck.size !== 0) {
            push(
                "disposed-terminal",
                `${at}: disposed store retains ${equalCheck.size} active subscription key(s)`,
            )
        }
        if (resources) {
            for (const key of [
                "mounts",
                "cleanups",
                "abortControllers",
                "cancellables",
                "globals",
            ] as const) {
                const value = resources[key]
                const size =
                    value instanceof Set
                        ? value.size
                        : value === undefined
                          ? 0
                          : 1
                if (size !== 0) {
                    push(
                        "disposed-terminal",
                        `${at}: disposed store retains ${size} ${key} resource(s)`,
                    )
                }
            }
        }
        if (data.changeListeners !== undefined) {
            push(
                "disposed-terminal",
                `${at}: disposed store retains changeListeners`,
            )
        }
        // Commit-end state is TREE-owned, so it is only terminal when the
        // disposed store IS its tree's root: detaching a scope must leave a
        // live root's listeners and in-flight depth untouched.
        if (data.tree.root === data) {
            if (data.tree.commitEndListeners !== undefined) {
                push(
                    "disposed-terminal",
                    `${at}: disposed store tree retains commitEndListeners`,
                )
            }
            if (data.tree.commitDepth !== 0) {
                push(
                    "disposed-terminal",
                    `${at}: disposed store tree retains commitDepth ${data.tree.commitDepth}`,
                )
            }
        }
        // Disposal clears the iterable indexes, but a leak can hide in a WeakMap
        // whose index was already drained. Audit every discovered/explicit state
        // (region is seeded from opts.states) against all terminal structures so
        // a registration behind a cleared index is still caught.
        for (const s of region) {
            if (subsSize(data, s) > 0) {
                push(
                    "disposed-terminal",
                    `${at}: disposed store retains subscribers for ${label(s)}`,
                )
            }
            if (depsOf(data, s)) {
                push(
                    "disposed-terminal",
                    `${at}: disposed store retains a dependency set for ${label(s)}`,
                )
            }
            if ((dependentsOf(data, s)?.size ?? 0) > 0) {
                push(
                    "disposed-terminal",
                    `${at}: disposed store retains reverse edges for ${label(s)}`,
                )
            }
            if (liveCounts?.get(s) !== undefined) {
                push(
                    "disposed-terminal",
                    `${at}: disposed store retains a liveDependentCount for ${label(s)}`,
                )
            }
            if (mounts?.has(s)) {
                push(
                    "disposed-terminal",
                    `${at}: disposed store retains a mount for ${label(s)}`,
                )
            }
            if (abortControllers?.get(s)) {
                push(
                    "disposed-terminal",
                    `${at}: disposed store retains an abort controller for ${label(s)}`,
                )
            }
        }
        return
    }

    const live = groundTruthLive(data, region)
    const anyHook = (() => {
        for (const s of region) if (hasOwnMount(s)) return true
        return false
    })()
    const graphActive = hasOwn<WeakSet<State>>(data, "selectorGraphActive")
    // A selector's forward set is mirrored into the iterable reverse graph iff
    // it is graph-active (or the store never enabled cold caches, in which case
    // every materialized selector graph is live-mirrored by construction). Cold
    // selectors deliberately hold forward edges with NO reverse edge, so the
    // forward => reverse direction only applies to mirrored selectors.
    const isMirrored = (s: State): boolean =>
        !data.coldSelectorCachesEnabled || (graphActive?.has(s) ?? false)

    // --- symmetric-edges --------------------------------------------------
    for (const s of region) {
        const deps = depsOf(data, s)
        if (deps) {
            if (!isSelector(s) && deps.size > 0) {
                push(
                    "dependency-ownership",
                    `${at}: non-selector ${label(s)} owns a forward dependency set`,
                )
            }
            if (isMirrored(s)) {
                for (const d of deps) {
                    const back = dependentsOf(data, d)
                    if (!back || !back.has(s)) {
                        push(
                            "symmetric-edges",
                            `${at}: mirrored ${label(s)} -> ${label(d)} has no matching reverse edge`,
                        )
                    }
                }
            }
        }
        // Reverse => forward is universal: a reverse edge is only ever committed
        // alongside its forward edge and torn down with it.
        const dependents = dependentsOf(data, s)
        if (dependents) {
            for (const t of dependents) {
                const forward = depsOf(data, t)
                if (!forward || !forward.has(s)) {
                    push(
                        "symmetric-edges",
                        `${at}: reverse edge ${label(t)} -> ${label(s)} has no matching forward edge`,
                    )
                }
            }
        }
    }

    // --- dependency-ownership: materialization order ----------------------
    for (const s of region) {
        const deps = depsOf(data, s)
        if (deps && deps.size > 0 && !dependencyOrder?.has(s)) {
            push(
                "dependency-ownership",
                `${at}: selector ${label(s)} has a dependency set but no dependencyOrder entry`,
            )
        }
    }

    // --- dependency-ownership: scope branch + value indexes ---------------
    const parent = data.parent
    if (parent) {
        const inheritedKeys = data.inheritedDependencyKeys
        for (const s of region) {
            if (!isInheritedState(s)) continue
            const isRegistered = inheritedKeys?.has(s) ?? false
            const ownBranches = hasOwn<WeakMap<State, Set<StoreData>>>(
                data,
                "inheritedDependencyBranches",
            )
            const hasDependent =
                (dependentsOf(data, s)?.size ?? 0) > 0 ||
                (ownBranches?.get(s)?.size ?? 0) > 0
            const inherits = isAtomFamily(s) || !data.values.has(s)
            const shouldRegister = hasDependent && inherits
            // The full recompute matches the engine's incremental rule only for
            // plain atoms. Atom-family containers and members inherit through the
            // family index overlay (out of scope here), so their registration is
            // governed by different bookkeeping — audit those only for the
            // membership cross-check below, not the shouldRegister recompute.
            const plainAtom = isAtom(s) && !isFamilyAtom(s) && !isAtomFamily(s)
            if (plainAtom && isRegistered !== shouldRegister) {
                push(
                    "dependency-ownership",
                    `${at}: inherited branch registration for ${label(s)} is ${isRegistered} but should be ${shouldRegister}`,
                )
            }
            if (isRegistered) {
                const branches = parent.inheritedDependencyBranches.get(s)
                if (!branches || !branches.has(data)) {
                    push(
                        "dependency-ownership",
                        `${at}: registered as inherited branch for ${label(s)} but absent from parent index`,
                    )
                }
            }
        }
        const scopeKeys = data.scopeIndexKeys
        if (scopeKeys) {
            for (const key of scopeKeys) {
                const set = parent.scopeValueIndex.get(key)
                if (!set || !set.has(data)) {
                    push(
                        "dependency-ownership",
                        `${at}: scopeIndexKey ${label(key as State)} not registered in parent scopeValueIndex`,
                    )
                }
            }
        }
    }

    // --- liveness-counts --------------------------------------------------
    const expected = new Map<State, number>()
    for (const t of live) {
        const deps = depsOf(data, t)
        if (!deps) continue
        for (const d of deps) expected.set(d, (expected.get(d) ?? 0) + 1)
    }
    for (const s of region) {
        const stored = liveCounts?.get(s)
        if (stored !== undefined) {
            if (!Number.isInteger(stored) || stored <= 0) {
                push(
                    "liveness-counts",
                    `${at}: liveDependentCount[${label(s)}] = ${stored} (must be a positive integer or absent)`,
                )
            }
        }
        const exp = expected.get(s) ?? 0
        const got = stored ?? 0
        if (got !== exp) {
            push(
                "liveness-counts",
                `${at}: liveDependentCount[${label(s)}] = ${got}, ground truth = ${exp}`,
            )
        }
    }

    // --- mount-state ------------------------------------------------------
    if (anyHook) {
        for (const s of region) {
            const isMounted = mounts?.has(s) ?? false
            if (isMounted && !hasOwnMount(s)) {
                push(
                    "mount-state",
                    `${at}: ${label(s)} is mounted but has no mount hook`,
                )
            }
            if (isMounted && !live.has(s)) {
                push(
                    "mount-state",
                    `${at}: ${label(s)} is mounted but is not live`,
                )
            }
            if (hasOwnMount(s) && live.has(s) && !isMounted) {
                push(
                    "mount-state",
                    `${at}: live hooked ${label(s)} is not mounted`,
                )
            }
            // mountInClosure no-false-negative invariant: a live state with a
            // mountable strict descendant requires the marker (or its own hook).
            // Restricted to live states — the marker is only maintained on the
            // live reverse graph, and only live states are ever mount-walked.
            if (
                live.has(s) &&
                hasHookedStrictDescendant(data, s) &&
                !hasOwnMount(s) &&
                !(mountInClosure?.has(s) ?? false)
            ) {
                push(
                    "mount-state",
                    `${at}: ${label(s)} has a mountable descendant but no mountInClosure marker`,
                )
            }
        }
    } else if (resources?.mounts && resources.mounts.size > 0) {
        push(
            "mount-state",
            `${at}: mount ledger is non-empty but no state in the region carries a hook`,
        )
    }

    // --- resource-balance -------------------------------------------------
    for (const s of region) {
        const controller = abortControllers?.get(s)
        if (controller && !(resources?.abortControllers?.has(controller) ?? false)) {
            push(
                "resource-balance",
                `${at}: abort controller for ${label(s)} is not tracked in store resources`,
            )
        }
        const subs = subsSize(data, s)
        if (subs > 0 && !(equalCheck?.has(s) ?? false)) {
            push(
                "resource-balance",
                `${at}: ${label(s)} has ${subs} subscriber(s) but is missing from the active-state index`,
            )
        }
        const mounted = mounts?.has(s) ?? false
        const inLedger = resources?.mounts?.has(s) ?? false
        if (mounted !== inLedger) {
            push(
                "resource-balance",
                `${at}: mount ledger disagrees with mounts map for ${label(s)} (map=${mounted} ledger=${inLedger})`,
            )
        }
    }
    if (equalCheck) {
        for (const s of equalCheck.keys()) {
            if (subsSize(data, s) === 0) {
                push(
                    "resource-balance",
                    `${at}: ${label(s)} is in the active-state index but has no subscribers`,
                )
            }
        }
    }
    // Reverse abort-controller direction (settled checkpoints only): every
    // controller still in the lifecycle ledger must map back to a discovered
    // state. A ledger entry with no mapping is a stale, strongly-retained
    // controller — the classic "forgot to untrack when replacing/cleaning an
    // evaluation" leak, which the forward (map -> ledger) check cannot see.
    if (opts.quiescent && resources?.abortControllers) {
        const mapped = new Set<AbortController>()
        if (abortControllers) {
            for (const s of region) {
                const controller = abortControllers.get(s)
                if (controller) mapped.add(controller)
            }
        }
        for (const controller of resources.abortControllers) {
            if (!mapped.has(controller)) {
                push(
                    "resource-balance",
                    `${at}: lifecycle ledger retains an abort controller not mapped to any live state`,
                )
            }
        }
    }

    // --- retained-registration (quiescent only) ---------------------------
    if (opts.quiescent) {
        const audit = explicit.length > 0 ? explicit : [...region]
        for (const s of audit) {
            if (live.has(s) || subsSize(data, s) > 0) continue
            const count = liveCounts?.get(s)
            if (count !== undefined && count > 0) {
                push(
                    "retained-registration",
                    `${at}: orphaned ${label(s)} retains liveDependentCount ${count}`,
                )
            }
            if (mounts?.has(s)) {
                push(
                    "retained-registration",
                    `${at}: orphaned ${label(s)} is still mounted`,
                )
            }
            if (abortControllers?.get(s)) {
                push(
                    "retained-registration",
                    `${at}: orphaned ${label(s)} retains an abort controller`,
                )
            }
            // A forward set with a revision-snapshot cache behind it is the
            // legitimate COLD shape — produced both by an unsubscribed read and
            // by orphan cleanup demoting a torn-down selector so a remount can
            // re-wire instead of re-evaluating. Promotion rebuilds the reverse
            // graph from exactly this set, and a dependency write invalidates it
            // by revision, so it is revalidatable rather than leaked. A forward
            // set with NO cache behind it is unreachable bookkeeping.
            const retainedDeps = isSelector(s) ? depsOf(data, s) : undefined
            if (retainedDeps) {
                const cache = coldCacheOf(data, s as Selector)
                if (!cache) {
                    push(
                        "retained-registration",
                        `${at}: orphaned selector ${label(s)} retains a dependency set with no cold cache`,
                    )
                } else {
                    // Presence alone would accept a cache that cannot actually
                    // revalidate this set. What makes the retention legitimate
                    // is that the snapshot COVERS the forward set and every
                    // member is revision-tracked, so a write to any of them
                    // invalidates it.
                    const snapshot = new Set(cache.dependencies)
                    const covers =
                        snapshot.size === retainedDeps.size &&
                        [...retainedDeps].every(dep => snapshot.has(dep))
                    if (!covers) {
                        push(
                            "retained-registration",
                            `${at}: orphaned selector ${label(s)} retains a dependency set its cold snapshot does not cover`,
                        )
                    }
                    const tracked = data.tree.trackedRevisions
                    const untracked = [...retainedDeps].filter(
                        dep => !(tracked?.has(dep) ?? false),
                    )
                    if (untracked.length > 0) {
                        push(
                            "retained-registration",
                            `${at}: orphaned selector ${label(s)} retains ${untracked.length} revision-untracked dependenc${untracked.length === 1 ? "y" : "ies"}, so its cold snapshot can never invalidate`,
                        )
                    }
                    if (cache.validatedAt > data.tree.revision) {
                        push(
                            "retained-registration",
                            `${at}: orphaned selector ${label(s)} has a cold snapshot validated at ${cache.validatedAt}, ahead of tree revision ${data.tree.revision}`,
                        )
                    }
                    // The pass stamp is the OTHER half of revalidatability, and
                    // it fails differently: `validatedAt` going stale only costs
                    // a re-walk, while a pass stamp that outruns the tree's pass
                    // counter is accepted by `coldCacheIsCurrentInPass` and
                    // silently serves the snapshot without any dependency
                    // comparison at all. A stamp ahead of the counter therefore
                    // means the snapshot can never be invalidated — the counter
                    // is monotonic, so no future write can catch up to it.
                    if (cache.validatedInPass > data.tree.coldValidationPass) {
                        push(
                            "retained-registration",
                            `${at}: orphaned selector ${label(s)} has a cold snapshot stamped in pass ${cache.validatedInPass}, ahead of tree pass ${data.tree.coldValidationPass}, so the pass memo can never retire it`,
                        )
                    }
                    // A non-validatable snapshot (`validatedAt < 0`) that still
                    // carries a live pass stamp is the same failure by another
                    // route: every reader checks `validatedAt < 0` BEFORE the
                    // pass memo precisely so an invalidation cannot be memoed
                    // away, and the two invalidation sites clear both fields
                    // together. A snapshot holding one but not the other means a
                    // third site invalidated only half of the pair.
                    if (
                        cache.validatedAt < 0 &&
                        cache.validatedInPass === data.tree.coldValidationPass
                    ) {
                        push(
                            "retained-registration",
                            `${at}: orphaned selector ${label(s)} has a non-validatable cold snapshot still stamped in the current pass ${cache.validatedInPass}`,
                        )
                    }
                }
            }
        }
    }
}

/** Run every invariant against `target` (a Store or a raw StoreData) and its
 *  scope subtree, returning a list of human-readable, category-tagged
 *  violations (empty when consistent). */
export const checkStoreInvariants = (
    target: Store | StoreData,
    opts: CheckOptions = {},
): string[] => {
    const root: StoreData =
        "stateDependencies" in (target as any)
            ? (target as StoreData)
            : getStoreData(target as Store)
    const skip = new Set(opts.skip ?? [])
    const violations: string[] = []
    const push = (category: InvariantCategory, message: string) => {
        if (skip.has(category)) return
        violations.push(`[${category}] ${message}`)
    }
    const explicit = opts.states ?? []
    for (const data of collectTree(root)) {
        const region = collectRegion(data, explicit)
        checkStore(data, region, explicit, opts, push)
    }
    return violations
}

/** Throw if any invariant is violated. Use at settled points inside tests. */
export const assertStoreInvariants = (
    target: Store | StoreData,
    opts: CheckOptions = {},
): void => {
    const violations = checkStoreInvariants(target, opts)
    if (violations.length > 0) {
        throw new Error(
            `Store invariant violation(s):\n  ${violations.join("\n  ")}`,
        )
    }
}
