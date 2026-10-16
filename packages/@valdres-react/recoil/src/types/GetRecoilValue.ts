import type { RecoilValue } from "../lib/recoilValue"

export type GetRecoilValue = <T>(recoilValue: RecoilValue<T>) => T
