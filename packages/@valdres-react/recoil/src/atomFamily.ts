import { createAtom } from "./lib/createAtom"
import { createFamilyCache } from "./lib/familyCache"
import type { RecoilState } from "./lib/recoilValue"
import { stableStringify } from "./lib/stableStringify"
import type { AtomFamilyOptions } from "./types/AtomFamilyOptions"
import type { SerializableParam } from "./types/SerializableParam"

/**
 * Recoil's `atomFamily`: one atom per parameter. Parameters are the same
 * member when Recoil's stable serialization matches (object key order, Set
 * and Map order and `undefined` properties do not matter), and members are
 * kept for the family's lifetime, as in Recoil.
 */
export const atomFamily = <T, P extends SerializableParam>(
    options: AtomFamilyOptions<T, P>,
): ((param: P) => RecoilState<T>) => {
    const cache = createFamilyCache<RecoilState<T>>(
        (options as { cachePolicyForParams_UNSTABLE?: { equality?: "value" | "reference" } })
            .cachePolicyForParams_UNSTABLE,
    )
    return (param: P) =>
        cache(param, () => {
            const { effects, effects_UNSTABLE } = options as {
                effects?: unknown
                effects_UNSTABLE?: unknown
            }
            const memberEffects =
                typeof effects === "function"
                    ? effects(param)
                    : typeof effects_UNSTABLE === "function"
                      ? effects_UNSTABLE(param)
                      : (effects ?? effects_UNSTABLE)
            const key = `${options.key}__${stableStringify(param) ?? "void"}`
            if (!("default" in options))
                return createAtom<T>({ key, effects: memberEffects } as never)
            const initial = options.default
            return createAtom<T>({
                key,
                default:
                    typeof initial === "function"
                        ? (initial as (param: P) => unknown)(param)
                        : initial,
                effects: memberEffects,
            } as never)
        })
}
