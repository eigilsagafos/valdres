import type { State } from "valdres"
import type { RecoilValue } from "../lib/recoilValue"

/** Also reads any Valdres State (a Valdres extension). */
export type GetRecoilValue = <T>(recoilValue: RecoilValue<T> | State<T>) => T
