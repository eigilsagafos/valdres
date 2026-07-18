import type { Atom } from "../types/Atom"
import type { GlobalAtom } from "../types/GlobalAtom"
import type { StoreData } from "../types/StoreData"
import { isGlobalAtom } from "../utils/isGlobalAtom"
import { isPromiseLike } from "../utils/isPromiseLike"
import type { CommitErrors } from "./commitErrors"
import { recordCommitError } from "./commitErrors"
import { getState } from "./getState"
import {
    beginCommit,
    commitEndRegistry,
    commitRootOf,
    endCommit,
} from "./onCommitEnd"
import { resolvePendingDefault } from "./resolvePendingDefault"
import { setValueInData } from "./setValueInData"
import { validateSchema } from "./validateSchema"
import type { DeferredOnSet } from "./writeAtoms"

/** A changed global atom whose value still needs to be applied to its peers. */
export type DeferredGlobalSet = [GlobalAtom<any>, any, StoreData]

export type StoreAtomUpdates = Map<StoreData, Atom<any>[]>

/** Hold every affected store tree's commit-end boundary across the shared
 * propagation/notification phase of a global write. */
export const beginGlobalCommit = (
    origin: StoreData,
    updates: StoreAtomUpdates,
): Iterable<StoreData> => {
    if (commitEndRegistry.count === 0) return []
    const roots = new Set<StoreData>([commitRootOf(origin)])
    for (const data of updates.keys()) roots.add(commitRootOf(data))
    for (const root of roots) beginCommit(root)
    return roots
}

export const endGlobalCommit = (
    roots: Iterable<StoreData>,
    errors: CommitErrors,
) => {
    for (const root of roots) {
        try {
            // Once an earlier phase failed, commit-end errors must not mask it.
            endCommit(root, errors.hasError)
        } catch (error) {
            recordCommitError(errors, error)
        }
    }
}

const addUpdates = (
    updates: StoreAtomUpdates,
    data: StoreData,
    atoms: Atom<any>[],
) => {
    if (atoms.length === 0) return
    const existing = updates.get(data)
    if (existing) existing.push(...atoms)
    else updates.set(data, atoms)
}

/**
 * Apply one already-resolved global value to a peer without running hooks or
 * propagation. The enclosing commit owns those later phases.
 */
const applyPeerValue = (
    atom: GlobalAtom<any>,
    value: any,
    data: StoreData,
): Atom<any>[] => {
    const initializedAtoms = new Set<Atom<any>>()
    const currentValue = getState(atom, data, initializedAtoms)
    value = validateSchema(atom, value, data)
    const currentIsPromise = isPromiseLike(currentValue)
    const areEqual =
        currentIsPromise || isPromiseLike(value)
            ? currentValue === value
            : atom.equal(currentValue, value)

    if (areEqual) {
        // Preserve the transaction/direct-set rule that an equal write in a
        // scope still establishes an own shadow.
        if (data.parent && !data.values.has(atom)) {
            setValueInData(atom, value, data)
        }
        return []
    }

    value = setValueInData(atom, value, data)
    if (currentIsPromise && !isPromiseLike(value)) {
        resolvePendingDefault(atom, data, value)
    }

    const updatedAtoms: Atom<any>[] = [atom]
    for (const initialized of initializedAtoms) updatedAtoms.push(initialized)
    return updatedAtoms
}

/**
 * Complete the write phase for global atoms. Every registered peer is attempted
 * before hooks or propagation begin; a failure in one peer cannot starve later
 * peers. Returned updates are grouped by store for the propagation phase.
 */
const applyGlobalSet = (
    atom: GlobalAtom<any>,
    value: any,
    origin: StoreData,
    updates: StoreAtomUpdates,
    errors: CommitErrors,
): void => {
    // Snapshot: initializing or user code in a later phase may mutate the
    // registration set, but it must not change this commit's fan-out list.
    for (const peer of [...atom.stores]) {
        try {
            // Store ids are user-provided labels and need not be unique. The
            // origin check is strictly StoreData identity. Skip its common
            // already-written case without paying getState/schema/equality
            // costs; if an earlier cross-store write in this commit overwrote
            // it, the raw value differs and it correctly goes through fan-out.
            if (
                peer === origin &&
                peer.values.has(atom) &&
                Object.is(peer.values.get(atom), value)
            ) {
                continue
            }
            // An origin reaches here only when an earlier write in the same
            // commit overwrote it. Applying it again makes the last queued
            // value win EVERYWHERE instead of leaving origins divergent.
            addUpdates(updates, peer, applyPeerValue(atom, value, peer))
        } catch (error) {
            recordCommitError(errors, error)
        }
    }
}

export const applyGlobalSets = (
    globalSets: DeferredGlobalSet[],
    errors: CommitErrors,
): StoreAtomUpdates => {
    const updates: StoreAtomUpdates = new Map()
    for (const [atom, value, origin] of globalSets) {
        applyGlobalSet(atom, value, origin, updates, errors)
    }
    return updates
}

/**
 * Apply only the global writes from a deferred-hook queue. Global atoms carry
 * an onSet marker even without a user hook, so the queue is also the complete
 * set of commit-sensitive writes. The updates map is created lazily: a
 * transaction containing ordinary user hooks but no globals allocates no
 * global fan-out state.
 */
export const applyGlobalOnSets = (
    onSets: DeferredOnSet[],
    errors: CommitErrors,
    updates?: StoreAtomUpdates,
): StoreAtomUpdates | undefined => {
    for (const [atom, value, origin] of onSets) {
        if (!isGlobalAtom(atom)) continue
        updates ??= new Map()
        applyGlobalSet(atom, value, origin, updates, errors)
    }
    return updates
}
