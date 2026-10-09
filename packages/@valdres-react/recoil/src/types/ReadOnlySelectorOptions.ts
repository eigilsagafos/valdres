import type { RecoilValue } from "../lib/recoilValue"
import type { GetRecoilValue } from "./GetRecoilValue"

/**
 * Recoil's read-only selector options. `get` is synchronous and receives
 * `get` only; `getCallback` is not supported.
 */
export interface ReadOnlySelectorOptions<T> {
    key: string
    get: (options: { get: GetRecoilValue }) => RecoilValue<T> | T
    /** Accepted for compatibility: values are never frozen. */
    dangerouslyAllowMutability?: boolean
    /**
     * Accepted for compatibility. Valdres keeps the result for the latest
     * dependency values only, like `{ eviction: "most-recent" }`.
     */
    cachePolicy_UNSTABLE?:
        | { eviction: "lru"; maxSize: number }
        | { eviction: "keep-all" }
        | { eviction: "most-recent" }
}
