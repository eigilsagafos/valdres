import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { isGlobalAtom } from "../utils/isGlobalAtom"
import { runCommitPlan } from "./commitEngine"
import { createCommitErrors } from "./commitErrors"
import { SETTLE_DEFAULT } from "./commitIntents"
import { getAtomInitValue } from "./initAtom"
import {
    changeListenerRegistry,
    createChangeSink,
    flushChangeSink,
} from "./notifyChangeListeners"
import { beginCommit, commitEndRegistry, endCommit } from "./onCommitEnd"
import { settleCommit } from "./propagateUpdatedAtoms"
import type { DeferredOnSet } from "./runOnSets"
import {
    createStoreDisposedError,
    DISPOSED_STORE_PENDING,
} from "./storeLifecycle"
import {
    abortTransaction,
    commitTransaction,
    TransactionContext,
} from "./transaction"
import { writeAtoms } from "./writeAtoms"

const resetGlobalAtom = <V>(atom: Atom<V>, data: StoreData): V | Promise<V> => {
    // TEMPORARY GLOBAL FAN-OUT ADAPTER — global reset remains on the transaction
    // path until the multi-store coordinator migration.
    const txn = new TransactionContext(data)
    try {
        const value = txn.reset(atom)
        commitTransaction(txn, "reset")
        return value
    } catch (error) {
        try {
            abortTransaction(txn)
        } catch {}
        throw error
    }
}

export const resetAtom = <V>(
    atom: Atom<V>,
    data: StoreData,
): V | Promise<V> => {
    if (isGlobalAtom(atom)) return resetGlobalAtom(atom as Atom<V>, data)

    // Phases 1–2: resolve/validate the default, then apply it with the same
    // normalization primitive used by bulk writes. This preserves equality,
    // pending-default, async-placeholder, scope-shadow, and family-index rules.
    const defaultInitializedAtoms = new Set<Atom>()
    const value = getAtomInitValue(atom, data, defaultInitializedAtoms) as
        | V
        | Promise<V>
    // The former transaction context was registered before evaluating the
    // default, so disposal from a user default cancelled the reset before its
    // write phase. Preserve that terminal-store guard without retaining the
    // transaction adapter for local commits.
    if (data.pendingOrphanCleanup === DISPOSED_STORE_PENDING) {
        throw createStoreDisposedError(data)
    }
    // Direct reset historically shared the transaction observer boundary: an
    // applied reset flushes onChange even if a later subscriber throws, and a
    // hook error remains the first error after every phase is attempted. Keep
    // writeAtoms inside that boundary as well: custom equality and initialization
    // callbacks ran there on the former transaction-backed path.
    const onSets: DeferredOnSet[] = []
    const updatedAtoms: Atom[] = []
    // Default resolution may lazily materialize selector dependencies. The
    // former transaction path did not carry those reads into commitWork's
    // write set, so keep the write phase's initialization tracking isolated:
    // only atoms initialized by the reset write itself may be settled/reported.
    const writeInitializedAtoms = new Set<Atom>()
    const pairs = new Map([[atom, value]])
    const changeSink =
        changeListenerRegistry.count === 0
            ? undefined
            : createChangeSink(undefined, "reset")
    runCommitPlan({
        data,
        settlement: {
            kind: "update",
            atoms: updatedAtoms,
            settle: settleCommit,
            flags: SETTLE_DEFAULT,
        },
        apply: () =>
            updatedAtoms.push(
                ...writeAtoms(
                    pairs,
                    data,
                    writeInitializedAtoms,
                    false,
                    onSets,
                ),
            ),
        onSets,
        errors: createCommitErrors(),
        report: changeSink,
        flushReport: changeSink ? () => flushChangeSink(changeSink) : undefined,
        beginCommit: commitEndRegistry.count === 0 ? undefined : beginCommit,
        endCommit: commitEndRegistry.count === 0 ? undefined : endCommit,
    })
    return value
}
