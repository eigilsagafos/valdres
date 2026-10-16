import type { RecoilValue } from "../lib/recoilValue"
import type { SerializableParam } from "./SerializableParam"

interface AtomFamilyOptionsWithoutDefault<P extends SerializableParam> {
    key: string
    /** Atom effects are not supported; only empty lists are accepted. */
    effects?: readonly [] | ((param: P) => readonly [])
    effects_UNSTABLE?: readonly [] | ((param: P) => readonly [])
    /** Accepted for compatibility: values are never frozen. */
    dangerouslyAllowMutability?: boolean
}

interface AtomFamilyOptionsWithDefault<T, P extends SerializableParam>
    extends AtomFamilyOptionsWithoutDefault<P> {
    default: RecoilValue<T> | T | ((param: P) => T | RecoilValue<T>)
}

/** Recoil's atomFamily options, without async defaults or effects. */
export type AtomFamilyOptions<T, P extends SerializableParam> =
    | AtomFamilyOptionsWithDefault<T, P>
    | AtomFamilyOptionsWithoutDefault<P>
