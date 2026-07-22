import type { Atom } from "../types/Atom"
import type { InternalGlobalAtom } from "../types/InternalGlobalAtom"
import type { StoreData } from "../types/StoreData"
import { isGlobalAtom } from "../utils/isGlobalAtom"
import { isPromiseLike } from "../utils/isPromiseLike"
import type { CommitErrors } from "./commitErrors"
import { recordCommitError } from "./commitErrors"
import { equal } from "./equal"
import { getState } from "./getState"
import { globalOnSetMarker } from "./globalOnSetMarker"
import { hasAtomCommitObservers } from "./hasAtomCommitObservers"
import { resolvePendingDefault } from "./resolvePendingDefault"
import { setValueInData } from "./setValueInData"
import { validateSchema } from "./validateSchema"
import type { DeferredOnSet } from "./runOnSets"

/** A changed global atom whose value still needs to be applied to its peers. */
export type DeferredGlobalSet = [InternalGlobalAtom<any>, any, StoreData]

export type StoreAtomUpdates = Map<StoreData, Atom<any>[]>

/** Extract ordered finalized global descriptors without applying them. */
export const collectGlobalOnSets = (
    onSets: DeferredOnSet[],
): DeferredGlobalSet[] | undefined => {
    let sets: DeferredGlobalSet[] | undefined
    for (const deferred of onSets) {
        if (!isGlobalAtom(deferred[0])) continue
        if (sets) sets.push(deferred as DeferredGlobalSet)
        else sets = [deferred as DeferredGlobalSet]
    }
    return sets
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
type PreparedPeerValue = {
    atom: InternalGlobalAtom<any>
    value: any
    data: StoreData
    currentIsPromise: boolean
    areEqual: boolean
    initializedAtoms: Set<Atom<any>>
}

const preparePeerValue = (
    atom: InternalGlobalAtom<any>,
    value: any,
    data: StoreData,
): PreparedPeerValue => {
    const initializedAtoms = new Set<Atom<any>>()
    const currentValue = getState(atom, data, initializedAtoms)
    value = validateSchema(atom, value, data)
    const currentIsPromise = isPromiseLike(currentValue)
    const areEqual =
        currentIsPromise || isPromiseLike(value)
            ? currentValue === value
            : atom.equal(currentValue, value)

    return {
        atom,
        value,
        data,
        currentIsPromise,
        areEqual,
        initializedAtoms,
    }
}

const applyPeerValue = (prepared: PreparedPeerValue): Atom<any>[] => {
    const { atom, data, currentIsPromise, areEqual, initializedAtoms } =
        prepared
    let { value } = prepared
    if (areEqual) {
        // Peer synchronization must not create a new scope shadow merely
        // because its parent already holds this commit's finalized value. An
        // explicit equal scope write was applied locally before fan-out and
        // already established its own shadow.
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
    atom: InternalGlobalAtom<any>,
    value: any,
    origin: StoreData,
    updates: StoreAtomUpdates,
    errors: CommitErrors,
): void => {
    // A scope can create its first own global shadow by writing an inherited
    // value, without running onInit locally. Register that origin before the
    // immutable peer snapshot so later global writes cannot strand the shadow.
    atom.attach(origin)
    // Snapshot: initializing or user code in a later phase may mutate the
    // registration set, but it must not change this commit's fan-out list.
    const prepared: PreparedPeerValue[] = []
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
            // Snapshot equality before applying any peer. A parent root may
            // precede its shadowing scope in registration order; reading the
            // scope after writing the parent would mask a real scope change.
            prepared.push(preparePeerValue(atom, value, peer))
        } catch (error) {
            recordCommitError(errors, error)
        }
    }
    // An origin reaches here only when an earlier write in the same commit
    // overwrote it. Applying it again makes the last queued value win
    // everywhere. Every peer was finalized above before the first is applied.
    for (const peer of prepared) {
        try {
            addUpdates(updates, peer.data, applyPeerValue(peer))
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
        try {
            applyGlobalSet(atom, value, origin, updates, errors)
        } catch (error) {
            recordCommitError(errors, error)
        }
    }
    return updates
}

/** Allocation-free global fast path for the strict primitive/no-observer
 * shape. All stores must already own the atom, use the built-in equality, and
 * require no per-store schema validation. Those gates make a direct Set walk
 * equivalent to phase-two application without allocating a CommitPlan,
 * update map, peer snapshot, or error accumulator. */
export const tryApplyUnobservedGlobalSet = (
    atom: InternalGlobalAtom<any>,
    value: any,
    origin: StoreData,
): boolean => {
    if (
        atom.onSet !== globalOnSetMarker ||
        atom.equal !== equal ||
        (value !== null &&
            (typeof value === "object" || typeof value === "function"))
    ) {
        return false
    }
    atom.attach(origin)
    for (const store of atom.stores) {
        if (
            !store.values.has(atom) ||
            hasAtomCommitObservers(atom, store) ||
            (atom.schema !== undefined &&
                (atom.schemaValidation ?? store.schemaValidation ?? false))
        ) {
            return false
        }
    }
    for (const store of atom.stores) {
        const currentValue = store.values.get(atom)
        if (!atom.equal(currentValue, value)) {
            setValueInData(atom, value, store)
            if (isPromiseLike(currentValue)) {
                resolvePendingDefault(atom, store, value)
            }
        }
    }
    return true
}
