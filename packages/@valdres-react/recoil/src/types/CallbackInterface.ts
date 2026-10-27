import type { Atom } from "valdres"
import type { RecoilState } from "../lib/recoilValue"
import type { Snapshot } from "./Snapshot"
import type { TransactionInterface_UNSTABLE } from "./TransactionInterface_UNSTABLE"

/**
 * What a useRecoilCallback factory receives. Recoil's `refresh` and
 * `gotoSnapshot` throw `UnsupportedRecoilFeatureError` and are not typed.
 */
export interface CallbackInterface {
    set: <T>(
        recoilState: RecoilState<T> | Atom<T>,
        valueOrUpdater: ((current: T) => T) | T,
    ) => void
    reset: (recoilState: RecoilState<any> | Atom<any>) => void
    snapshot: Snapshot
    transact_UNSTABLE: (update: (transaction: TransactionInterface_UNSTABLE) => void) => void
}
