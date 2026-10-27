import type { Atom } from "valdres"
import type { RecoilState, RecoilValue } from "../lib/recoilValue"

/** Recoil's atomic update interface. Atoms only. */
export interface TransactionInterface_UNSTABLE {
    get<T>(recoilValue: RecoilValue<T> | Atom<T>): T
    set<T>(recoilState: RecoilState<T> | Atom<T>, valueOrUpdater: ((current: T) => T) | T): void
    reset(recoilState: RecoilState<any> | Atom<any>): void
}
