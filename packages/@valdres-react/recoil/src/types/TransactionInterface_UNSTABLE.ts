import type { RecoilState, RecoilValue } from "../lib/recoilValue"

/** Recoil's atomic update interface. Atoms only. */
export interface TransactionInterface_UNSTABLE {
    get<T>(recoilValue: RecoilValue<T>): T
    set<T>(recoilState: RecoilState<T>, valueOrUpdater: ((current: T) => T) | T): void
    reset(recoilState: RecoilState<any>): void
}
