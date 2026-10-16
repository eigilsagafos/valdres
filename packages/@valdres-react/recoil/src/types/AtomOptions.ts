import type { RecoilValue } from "../lib/recoilValue"

interface AtomOptionsWithoutDefault {
    key: string
    /**
     * Atom effects are not supported; only an empty list is accepted. See
     * `UnsupportedRecoilFeatureError`.
     */
    effects?: readonly []
    effects_UNSTABLE?: readonly []
    /** Accepted for compatibility: values are never frozen. */
    dangerouslyAllowMutability?: boolean
}

interface AtomOptionsWithDefault<T> extends AtomOptionsWithoutDefault {
    default: RecoilValue<T> | T
}

/**
 * Recoil's atom options. Without `default`, reading the atom before it is set
 * throws instead of suspending.
 */
export type AtomOptions<T> = AtomOptionsWithoutDefault | AtomOptionsWithDefault<T>
