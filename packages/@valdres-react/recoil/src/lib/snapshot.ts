import type { Transaction } from "valdres"
import type { MutableSnapshot } from "../types/MutableSnapshot"
import type { Snapshot } from "../types/Snapshot"
import type { SnapshotID } from "../types/SnapshotID"
import { applyAction, readThrough, resetAction, setAction } from "./actions"
import type { OpenTransaction } from "./batch"
import { loadableOf } from "./loadable"
import type { RecoilValue } from "./recoilValue"
import { unsupported } from "./unsupported"

let nextSnapshotID = 0

const refuse = (feature: string) => () =>
    unsupported(
        feature,
        "A Valdres Store has no persistent snapshots; read state with snapshot.getLoadable or getPromise while the callback runs synchronously.",
    )

/** The members Recoil's Snapshot has that cannot be honored here. */
const refusedMembers = {
    getNodes_UNSTABLE: refuse("snapshot.getNodes_UNSTABLE"),
    getInfo_UNSTABLE: refuse("snapshot.getInfo_UNSTABLE"),
    map: refuse("snapshot.map"),
    asyncMap: refuse("snapshot.asyncMap"),
    retain: refuse("snapshot retain"),
    isRetained: refuse("snapshot retain"),
}

/**
 * `assertReadable` throws a refusal; it runs before the read so the refusal
 * is never captured into an error loadable or rejected promise.
 */
const snapshotReader = (
    assertReadable: () => void,
    tx: Pick<Transaction, "get">,
): Snapshot => {
    const id = nextSnapshotID++ as unknown as SnapshotID
    const loadable = <Value>(recoilValue: RecoilValue<Value>) => {
        assertReadable()
        return loadableOf(() => readThrough(tx, recoilValue, "snapshot.getLoadable"))
    }
    return {
        getID: () => id,
        getLoadable: loadable,
        getPromise: recoilValue => loadable(recoilValue).toPromise(),
        ...refusedMembers,
    } as Snapshot
}

/**
 * A callback's snapshot: the open transaction, read before anything is staged
 * in it. Recoil clones the store and keeps that clone readable for as long as
 * the callback runs; Valdres has no clone, so a read once the synchronous part
 * has returned, or after writes were applied mid-callback, throws instead of
 * returning later state.
 */
export const callbackSnapshot = (open: OpenTransaction): Snapshot => {
    const { tx, epoch } = open
    if (tx === undefined)
        return snapshotReader(
            () =>
                unsupported(
                    "snapshot of another root inside a callback",
                    "This callback was called from a useRecoilCallback of another <RecoilRoot>, whose transaction keeps this root's Store unreadable until it ends; read the snapshot outside that callback.",
                ),
            { get: () => undefined as never },
        )
    return snapshotReader(() => {
        if (open.closed)
            unsupported(
                "snapshot after synchronous phase",
                "Read the snapshot before the callback's first await (or before returning), and pass the values on.",
            )
        if (open.epoch !== epoch)
            unsupported(
                "snapshot after nested writes",
                "A nested useRecoilCallback or transact_UNSTABLE applied writes after this snapshot was taken; read the snapshot before that call.",
            )
    }, tx)
}

/**
 * `initializeState`'s snapshot: writes apply immediately and later reads see
 * them, as in Recoil's MutableSnapshot.
 */
export const mutableSnapshot = (
    tx: Transaction,
    isOpen: () => boolean,
): MutableSnapshot => {
    const assertOpen = () => {
        if (!isOpen())
            unsupported(
                "MutableSnapshot after initializeState",
                "Use the MutableSnapshot only while initializeState runs.",
            )
    }
    const snapshot = snapshotReader(assertOpen, tx)
    return Object.assign(snapshot, {
        set: (recoilState: RecoilValue<any>, valueOrUpdater: unknown) => {
            assertOpen()
            applyAction(tx, setAction(recoilState, valueOrUpdater))
        },
        reset: (recoilState: RecoilValue<any>) => {
            assertOpen()
            applyAction(tx, resetAction(recoilState))
        },
    }) as MutableSnapshot
}
