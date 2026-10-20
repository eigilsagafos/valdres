import type { RecoilValue } from "../lib/recoilValue"
import type { GetRecoilValue } from "./GetRecoilValue"
import type { ReadOnlySelectorOptions } from "./ReadOnlySelectorOptions"
import type { SerializableParam } from "./SerializableParam"

export interface ReadOnlySelectorFamilyOptions<T, P extends SerializableParam> {
    key: string
    get: (param: P) => (options: { get: GetRecoilValue }) => RecoilValue<T> | T
    /** See `ReadOnlySelectorOptions.cachePolicy_UNSTABLE`. */
    cachePolicy_UNSTABLE?: ReadOnlySelectorOptions<T>["cachePolicy_UNSTABLE"]
    /** Accepted for compatibility: values are never frozen. */
    dangerouslyAllowMutability?: boolean
}
