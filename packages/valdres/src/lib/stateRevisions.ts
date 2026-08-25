import type { Selector } from "../types/Selector"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import type { StoreTreeRuntime } from "./storeTreeRuntime"
import { isSelector } from "../utils/isSelector"

/**
 * Record a materialized state value changing. Revision tracking is enabled by
 * the first cold selector cache in the store tree; atom-only stores therefore
 * keep the write hot path to one predictable boolean branch.
 */
export const noteStateValueChanged = (state: WeakKey, data: StoreData) => {
    const tree = data.tree
    // The in-pass check sits ahead of the tracking gate for the same reason as in
    // lib/setValueInData.ts: an untracked state's change still reaches cold
    // snapshots through the live selectors that read it.
    if (tree.coldValidationDepth !== 0) endColdValidationPass(state, tree)
    if (!tree.revisionEnabled || !tree.trackedRevisions!.has(state)) return
    data.stateRevisions.set(state, ++tree.revision)
}

/** A tracked revision advanced while a validation pass was in flight. End the
 * pass unless the walk could have derived that change itself. */
/** Retire the validation pass outright, whatever raised the change. For the
 * out-of-band paths — a late async dependency desynchronizing a snapshot, an
 * async selector settling or its rejection being cleaned up — where the
 * `isSelector` exemption below would otherwise wrongly apply: those replace a
 * selector's value from OUTSIDE the walk, so no walk derived them. */
export const endColdValidationPassForExternalChange = (
    tree: StoreTreeRuntime,
) => {
    tree.coldValidationPass++
}

export const endColdValidationPass = (
    state: WeakKey,
    tree: StoreTreeRuntime,
) => {
    // The pass memo rests on one premise: the clock only moved because the walk
    // re-derived a value from sources that did NOT change. Anything else has to
    // end the pass, or a snapshot the walk already proved current keeps being
    // served after what it observed changed underneath it (pinned by
    // lib/coldSelectorCacheValidationPass.test.ts, "a write from inside a
    // selector body ends the pass").
    //
    // SELECTORS are the exemption, and the only one: a selector's value is a
    // pure function of its dependencies, so the walk re-materializing one is
    // exactly the clock movement the pass exists to tolerate — tolerating it is
    // the entire point. Everything else reaching here is a real source change:
    // an atom written by user code re-entering the store from a selector body,
    // an atom default resolving for the first time, a family's membership
    // moving, an `unset`. Ending the pass costs the rest of the walk (and later
    // reads) a re-validation against the new revisions — the pre-fix cost, and
    // the conservative direction.
    //
    // Split out of `noteStateValueChanged` and guarded at both call sites by a
    // plain integer compare, so an ordinary write — no validation in flight —
    // never reaches this state-shape check.
    if (!isSelector(state)) tree.coldValidationPass++
}

/** Start maintaining a revision for a state newly discovered by a cold async
 * selector. This must happen at read time, not promise settlement, so a write
 * between those events advances beyond the revision the evaluation observed. */
export const trackStateRevision = (state: WeakKey, data: StoreData) => {
    const tree = data.tree
    const tracked = (tree.trackedRevisions ??= new WeakSet())
    tracked.add(state)
    tree.revisionEnabled = true
}

/** Resolve the revision of the value this store would actually read. Scoped
 * atoms without a local shadow inherit their closest ancestor's revision —
 * unless this store recorded a LATER one, which happens when it dropped a value
 * it used to own (see below). */
export const getStateRevision = (state: WeakKey, data: StoreData): number => {
    // Root stores dominate. Check parent first so their revision reads avoid an
    // otherwise redundant values.has() WeakMap probe.
    if (!data.parent || data.values.has(state)) {
        return data.stateRevisions.get(state) ?? 0
    }
    const inherited = getStateRevision(state, data.parent)
    // No local value, yet a local revision can still exist — `unset` is the one
    // write that removes a store's own value instead of replacing it, and it
    // records the bump here on the way out. What this store reads DID change,
    // so that bump has to outrank the (unchanged) inherited revision until an
    // ancestor write overtakes it.
    //
    // Without the max, a cold selector cached while the scope owned the value
    // revalidates against the ancestor's revision — which is not the one it
    // recorded from, but happens to be equal often enough (both 0 before any
    // tracked ancestor write) — so the cache "validates" and serves the
    // pre-unset value for the life of the scope.
    const local = data.stateRevisions.get(state)
    return local !== undefined && local > inherited ? local : inherited
}

/** Snapshot a cold selector's forward dependencies without putting the
 * selector in any dependency's strongly-held reverse Set. */
export const recordColdSelectorCache = (
    selector: Selector,
    dependencies: Set<State>,
    data: StoreData,
    revisions?: Map<State, number>,
): boolean => {
    if (data.selectorGraphActive.has(selector)) {
        data.coldSelectorCaches.delete(selector)
        return true
    }

    data.coldSelectorCachesEnabled = true
    const tree = data.tree
    const tracked = (tree.trackedRevisions ??= new WeakSet())
    tree.revisionEnabled = true
    const existingCache = data.coldSelectorCaches.get(selector)
    const dependencyStates = existingCache?.dependencies ?? []
    const dependencyRevisions = existingCache?.dependencyRevisions ?? []
    dependencyRevisions.length = 0
    let hasSelectorDependencies = false
    let matchesCurrentValues = true
    let index = 0
    for (const dependency of dependencies) {
        if (dependencyStates[index] !== dependency) {
            tracked.add(dependency)
        }
        dependencyStates[index] = dependency
        if (isSelector(dependency)) hasSelectorDependencies = true
        const currentRevision = getStateRevision(dependency, data)
        const revision = revisions?.get(dependency) ?? currentRevision
        dependencyRevisions.push(revision)
        if (revision !== currentRevision) {
            matchesCurrentValues = false
        }
        index++
    }
    dependencyStates.length = index
    const validatedAt = matchesCurrentValues ? tree.revision : -1
    // A snapshot that does NOT match current values is deliberately given pass
    // `0`: it is non-validatable, and the pass memo must never resurrect it.
    // Stamp the pass ONLY from inside a validation walk that proved this
    // closure, and only if that walk never leaned on the cycle guard's guess.
    // A snapshot rebuilt outside a walk — an async settlement landing in a
    // microtask — has proven nothing, yet the pass it would name is very often
    // still authoritative, which would make it permanently un-invalidatable.
    // `validatedAt` alone is the right memo there: it is stamped at the current
    // revision, so the next real change retires it.
    const validatedInPass =
        matchesCurrentValues && tree.coldValidationDepth !== 0
            ? tree.coldValidationPass
            : 0
    if (existingCache) {
        existingCache.hasSelectorDependencies = hasSelectorDependencies
        existingCache.validatedAt = validatedAt
        existingCache.validatedInPass = validatedInPass
    } else {
        data.coldSelectorCaches.set(selector, {
            dependencies: dependencyStates,
            dependencyRevisions,
            validatedAt,
            validatedInPass,
            hasSelectorDependencies,
        })
    }
    return matchesCurrentValues
}

/** A selector write advances the shared clock after its dependency snapshot was
 * recorded. Move a known-current snapshot forward without rebuilding it. */
export const markColdSelectorCacheValidated = (
    selector: Selector,
    data: StoreData,
) => {
    const cache = data.coldSelectorCaches.get(selector)
    if (!cache) return
    const tree = data.tree
    // A re-evaluation inside a validation pass may have read dependencies the
    // cycle guard only GUESSED were fresh, so the value just committed is not
    // necessarily consistent with them — record neither stamp. Outside a pass
    // the counter is 0, so ordinary cold reads take the normal path. See
    // lib/getState.ts, `isColdSelectorCacheFresh`.
    cache.validatedAt = tree.revision
    // See recordColdSelectorCache: outside a walk, nothing proved the closure.
    if (tree.coldValidationDepth !== 0) {
        cache.validatedInPass = tree.coldValidationPass
    }
}
