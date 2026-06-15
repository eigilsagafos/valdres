import { valdresGlobal } from "./lib/valdresGlobal"

// `process.env.VALDRES_VERSION` is statically replaced at build time by
// Bun.build's define option. Declared at module scope (not global) so we
// don't conflict with consumers' @types/node or bun-types.
declare const process: { env: { VALDRES_VERSION?: string } }
// Single-instance guard. The slot (see valdresGlobal) also carries the global
// name registry; `version` is claimed exactly once, by the first instance.
const slot = valdresGlobal()
if (slot.version) {
    throw new Error(
        `Error! An instance of valdres is already loaded. Loaded: ${slot.version}. Attempted to load: ${process.env.VALDRES_VERSION}`,
    )
} else {
    slot.version = process.env.VALDRES_VERSION
}

export { atom } from "./atom"
export { atomFamily } from "./atomFamily"
export { cacheMeta } from "./cacheMeta"
export { globalStore } from "./globalStore"
export { index } from "./indexConstructor"
export { selector } from "./selector"
export { selectorFamily } from "./selectorFamily"
export { store } from "./store"

export { SchemaValidationError } from "./errors/SchemaValidationError"
export { deepFreeze } from "./utils/deepFreeze"
export { dehydrate } from "./utils/dehydrate"
export { hydrate } from "./utils/hydrate"
export { setAtomPairs } from "./utils/setAtomPairs"
export { isAtom } from "./utils/isAtom"
export { isAtomFamily } from "./utils/isAtomFamily"
export { isFamily } from "./utils/isFamily"
export { isFamilyAtom } from "./utils/isFamilyAtom"
export { isFamilySelector } from "./utils/isFamilySelector"
export { isFamilyState } from "./utils/isFamilyState"
export { isPromiseLike } from "./utils/isPromiseLike"
export { isSelector } from "./utils/isSelector"
export { isSelectorFamily } from "./utils/isSelectorFamily"
export { isSuspendError } from "./lib/initSelector"
export { Transaction } from "./lib/transaction"

export type { CacheMeta } from "./cacheMeta"
export type { Atom } from "./types/Atom"
export type { AtomFamily } from "./types/AtomFamily"
export type { DehydratedState } from "./types/DehydratedState"
export type { HydrateOptions } from "./utils/hydrate"
export type { InitializeCallback } from "./types/InitializeCallback"
export type { FamilyKey } from "./types/FamilyKey"
export type { GetValue } from "./types/GetValue"
export type { Reactive } from "./types/Reactive"
export type { GlobalAtom, MaxAgeInterval } from "./types/GlobalAtom"
export type { GlobalAtomGetSelfFunc } from "./types/GlobalAtomGetSelfFunc"
export type { GlobalAtomResetSelfFunc } from "./types/GlobalAtomResetSelfFunc"
export type { GlobalAtomSetSelfFunc } from "./types/GlobalAtomSetSelfFunc"
export type { ResetAtom } from "./types/ResetAtom"
export type { Selector, SelectorGetOptions } from "./types/Selector"
export type { SelectorFamily } from "./types/SelectorFamily"
export type { SetAtom } from "./types/SetAtom"
export type { SnapshotEntry } from "./types/SnapshotEntry"
export type { SetAtomValue } from "./types/SetAtomValue"
export type { SyncSetAtom } from "./types/SyncSetAtom"
export type { State } from "./types/State"
export type { Schema } from "./types/Schema"
export type { StandardSchemaV1 } from "./types/StandardSchemaV1"
export type { Store } from "./types/Store"
export type {
    AtomChange,
    SelectorChange,
    StoreChange,
} from "./types/StoreChange"
export type { StoreChangeCallback } from "./types/StoreChangeCallback"
export type { StoreChangeMeta } from "./types/StoreChangeMeta"
export type { StoreChangeSource } from "./types/StoreChangeSource"
export type { StoreData } from "./types/StoreData"
export type { TransactionFn } from "./types/TransactionFn"
export type { TransactionInterface } from "./types/TransactionInterface"
