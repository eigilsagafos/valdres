import type { Atom } from "valdres"
import type { RecoilState } from "../lib/recoilValue"

export type ResetRecoilState = (recoilState: RecoilState<any> | Atom<any>) => void
