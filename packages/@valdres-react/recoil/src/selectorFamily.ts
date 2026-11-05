import { createSelector } from "./lib/createSelector"
import { createFamilyCache } from "./lib/familyCache"
import type { RecoilState, RecoilValueReadOnly } from "./lib/recoilValue"
import { stableStringify } from "./lib/stableStringify"
import type { ReadOnlySelectorFamilyOptions } from "./types/ReadOnlySelectorFamilyOptions"
import type { ReadOnlySelectorOptions } from "./types/ReadOnlySelectorOptions"
import type { ReadWriteSelectorFamilyOptions } from "./types/ReadWriteSelectorFamilyOptions"
import type { ReadWriteSelectorOptions } from "./types/ReadWriteSelectorOptions"
import type { SerializableParam } from "./types/SerializableParam"

let nextIndex = 0

interface SelectorFamilyFactory {
    <T, P extends SerializableParam>(
        options: ReadWriteSelectorFamilyOptions<T, P>,
    ): (param: P) => RecoilState<T>
    <T, P extends SerializableParam>(
        options: ReadOnlySelectorFamilyOptions<T, P>,
    ): (param: P) => RecoilValueReadOnly<T>
}

/**
 * Recoil's `selectorFamily`: one selector per parameter, with Recoil's
 * parameter identity and member keys.
 */
export const selectorFamily: SelectorFamilyFactory = (<T, P extends SerializableParam>(
    options: ReadOnlySelectorFamilyOptions<T, P> | ReadWriteSelectorFamilyOptions<T, P>,
) => {
    const cache = createFamilyCache<RecoilValueReadOnly<T>>(
        (options as { cachePolicyForParams_UNSTABLE?: { equality?: "value" | "reference" } })
            .cachePolicyForParams_UNSTABLE,
        error =>
            new Error(
                `Problem with cache lookup for selector ${options.key}: ${error.message}`,
            ),
    )
    return (param: P) =>
        cache(param, () => {
            const key = `${options.key}__selectorFamily/${
                stableStringify(param, { allowFunctions: true }) ?? "void"
            }/${nextIndex++}`
            const get: ReadOnlySelectorOptions<T>["get"] = callbacks =>
                options.get(param)(callbacks)
            if (!("set" in options)) return createSelector<T>({ key, get })
            const set: ReadWriteSelectorOptions<T>["set"] = (callbacks, newValue) =>
                options.set(param)(callbacks, newValue)
            return createSelector<T>({ key, get, set })
        })
}) as SelectorFamilyFactory
