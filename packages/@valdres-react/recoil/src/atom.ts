import { createAtom } from "./lib/createAtom"
import type { RecoilState } from "./lib/recoilValue"
import type { AtomOptions } from "./types/AtomOptions"

/**
 * Recoil's `atom`: writable state with a key and a default. The default may
 * be a value or another atom/selector; `effects` and async defaults throw
 * `UnsupportedRecoilFeatureError`.
 */
export const atom = <T>(options: AtomOptions<T>): RecoilState<T> =>
    createAtom(options)
