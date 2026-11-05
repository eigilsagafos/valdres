import type { DefaultValue } from "../DefaultValue"
import type { GetRecoilValue } from "./GetRecoilValue"
import type { ReadOnlySelectorOptions } from "./ReadOnlySelectorOptions"
import type { ResetRecoilState } from "./ResetRecoilState"
import type { SetRecoilState } from "./SetRecoilState"

/**
 * Recoil's writable selector options. `set` reads the state from before its
 * own writes, and its writes apply together when it returns.
 */
export interface ReadWriteSelectorOptions<T> extends ReadOnlySelectorOptions<T> {
    set: (
        options: {
            set: SetRecoilState
            get: GetRecoilValue
            reset: ResetRecoilState
        },
        newValue: T | DefaultValue,
    ) => void
}
