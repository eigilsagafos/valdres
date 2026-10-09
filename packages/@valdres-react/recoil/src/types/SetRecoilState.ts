import type { DefaultValue } from "../DefaultValue"
import type { RecoilState } from "../lib/recoilValue"

export type SetRecoilState = <T>(
    recoilState: RecoilState<T>,
    newValue: T | DefaultValue | ((previous: T) => T | DefaultValue),
) => void
