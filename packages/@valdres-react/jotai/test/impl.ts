/**
 * The implementation under test. `JOTAI_IMPL=jotai` runs a suite against the
 * real Jotai 3.0.1 (the compatibility reference); anything else runs it against
 * this package. The same test file therefore states Jotai's behavior and checks
 * the adapter against it.
 */
import * as reference from "jotai-reference"
import * as adapter from "../src/index"

export const IMPL: "jotai" | "valdres" =
    process.env.JOTAI_IMPL === "jotai" ? "jotai" : "valdres"

const impl = (IMPL === "jotai" ? reference : adapter) as typeof adapter

export const atom: typeof adapter.atom = impl.atom
export const createStore: typeof adapter.createStore = impl.createStore
export const getDefaultStore: typeof adapter.getDefaultStore =
    impl.getDefaultStore
export const Provider: typeof adapter.Provider = impl.Provider
export const useAtom: typeof adapter.useAtom = impl.useAtom
export const useAtomValue: typeof adapter.useAtomValue = impl.useAtomValue
export const useSetAtom: typeof adapter.useSetAtom = impl.useSetAtom
export const useStore: typeof adapter.useStore = impl.useStore

export type {
    Atom,
    ExtractAtomArgs,
    ExtractAtomResult,
    ExtractAtomValue,
    Getter,
    PrimitiveAtom,
    SetStateAction,
    Setter,
    Store,
    WritableAtom,
} from "../src/index"

export const useAtomValueRaw: typeof adapter.useAtomValueRaw =
    impl.useAtomValueRaw
export const useAtomValueRawSync: typeof adapter.useAtomValueRawSync =
    impl.useAtomValueRawSync
