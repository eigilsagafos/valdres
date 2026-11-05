import { createSelector } from "./lib/createSelector"
import type { RecoilState, RecoilValueReadOnly } from "./lib/recoilValue"
import type { ReadOnlySelectorOptions } from "./types/ReadOnlySelectorOptions"
import type { ReadWriteSelectorOptions } from "./types/ReadWriteSelectorOptions"

interface SelectorFactory {
    <T>(options: ReadWriteSelectorOptions<T>): RecoilState<T>
    <T>(options: ReadOnlySelectorOptions<T>): RecoilValueReadOnly<T>
}

/**
 * Recoil's `selector`: synchronous derived state, writable when `set` is
 * given. Async results and `getCallback` throw
 * `UnsupportedRecoilFeatureError`.
 */
export const selector: SelectorFactory = createSelector
