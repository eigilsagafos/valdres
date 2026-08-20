import { valdresGlobal } from "./lib/valdresGlobal"

// `process.env.VALDRES_VERSION` is statically replaced at build time by
// Bun.build's define option. Declared at module scope (not global) so we
// don't conflict with consumers' @types/node or bun-types.
declare const process: { env?: { VALDRES_VERSION?: string } }
declare const __VALDRES_BUILD_VARIANT__: string

const BUILD_VARIANT =
    typeof __VALDRES_BUILD_VARIANT__ === "undefined"
        ? "source"
        : __VALDRES_BUILD_VARIANT__
const VERSION =
    typeof process === "undefined" || process.env == null
        ? undefined
        : process.env.VALDRES_VERSION

// Runtime compatibility guard. The slot (see valdresGlobal) carries the shared
// global engine surface and name registry. A known same-version copy adopts
// that surface; different versions, or duplicates where either version is
// unknown, cannot prove compatibility and fail before exposing the copy.
const slot = valdresGlobal()
if (slot.loaded) {
    const details = `Loaded: ${slot.version ?? "unknown"} (${slot.buildVariant ?? "unknown"}). Attempted: ${VERSION ?? "unknown"} (${BUILD_VARIANT}).`
    if (slot.version === undefined || VERSION === undefined) {
        throw new Error(
            `valdres: cannot safely load another runtime because at least one valdres version is unknown. ${details} ` +
                `Build valdres or inject process.env.VALDRES_VERSION so same-version copies can adopt the shared runtime.`,
        )
    }
    if (slot.version !== VERSION) {
        throw new Error(
            `valdres: cannot load different valdres versions in the same JavaScript global. ${details} ` +
                `Ensure the dependency graph resolves one version and deduplicate valdres dependencies.`,
        )
    }
    if (!slot.adoptable) {
        throw new Error(
            `valdres: the loaded same-version instance does not expose the shared runtime required for safe adoption. ${details} ` +
                `Deduplicate valdres dependencies or reload after upgrading every copy together.`,
        )
    }
} else {
    slot.loaded = true
    slot.version = VERSION
    slot.buildVariant = BUILD_VARIANT
}

export { atom } from "./atom"
export { atomFamily } from "./atomFamily"
export { cacheMeta } from "./cacheMeta"
export { globalAtom } from "./globalAtom"
export { globalAtomFamily } from "./globalAtomFamily"
export { globalStore } from "./globalStore"
export { index } from "./indexConstructor"
export { selector } from "./selector"
export { selectorFamily } from "./selectorFamily"
export { store } from "./store"

export { SchemaValidationError } from "./errors/SchemaValidationError"
export { SelectorCircularDependencyError } from "./errors/SelectorCircularDependencyError"
export { SelectorEvaluationError } from "./errors/SelectorEvaluationError"
export { StoreDisposedError } from "./errors/StoreDisposedError"
export { deepFreeze } from "./utils/deepFreeze"
export { dehydrate } from "./utils/dehydrate"
export { hydrate } from "./utils/hydrate"
export { setAtomPairs } from "./utils/setAtomPairs"
export { applyInitialize } from "./utils/applyInitialize"
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

export type { CacheMeta } from "./cacheMeta"
export type { Atom } from "./types/Atom"
export type { AtomDefaultValue } from "./types/AtomDefaultValue"
export type { AtomFamily } from "./types/AtomFamily"
export type { AtomFamilyAtom } from "./types/AtomFamilyAtom"
export type { AtomFamilyDefaultValue } from "./types/AtomFamilyDefaultValue"
export type { AtomFamilyOptions } from "./types/AtomFamilyOptions"
export type { AtomFamilySelector } from "./types/AtomFamilySelector"
export type { AtomOnMount } from "./types/AtomOnMount"
export type { AtomOnSet } from "./types/AtomOnSet"
export type { AtomOptions } from "./types/AtomOptions"
export type { DehydratedState } from "./types/DehydratedState"
export type { EqualFunc } from "./types/EqualFunc"
export type { HydrateOptions } from "./utils/hydrate"
export type { InitializeCallback } from "./types/InitializeCallback"
export type { IndexOptions } from "./types/IndexOptions"
export type { FamilyKey } from "./types/FamilyKey"
export type { GetValue } from "./types/GetValue"
export type { Reactive } from "./types/Reactive"
export type { GlobalAtom } from "./types/GlobalAtom"
export type { GlobalAtomFamily } from "./types/GlobalAtomFamily"
export type { GlobalAtomFamilyOptions } from "./types/GlobalAtomFamilyOptions"
export type { GlobalAtomGetSelfFunc } from "./types/GlobalAtomGetSelfFunc"
export type { GlobalAtomOptions } from "./types/GlobalAtomOptions"
export type { GlobalAtomResetSelfFunc } from "./types/GlobalAtomResetSelfFunc"
export type { GlobalAtomSetSelfFunc } from "./types/GlobalAtomSetSelfFunc"
export type { ResetAtom } from "./types/ResetAtom"
export type { Selector, SelectorGetOptions } from "./types/Selector"
export type { SelectorFamily } from "./types/SelectorFamily"
export type { SelectorFamilyOptions } from "./types/SelectorFamilyOptions"
export type { SelectorOptions } from "./types/SelectorOptions"
export type { SetAtom } from "./types/SetAtom"
export type { SnapshotEntry } from "./types/SnapshotEntry"
export type { SetAtomValue } from "./types/SetAtomValue"
export type { SyncSetAtom } from "./types/SyncSetAtom"
export type { State } from "./types/State"
export type { Schema } from "./types/Schema"
export type { StandardSchemaV1 } from "./types/StandardSchemaV1"
export type { ScopedStore, ScopeFn, Store } from "./types/Store"
export type { StoreOptions } from "./types/StoreOptions"
export type { SubscribeFn } from "./types/SubscribeFn"
export type {
    AtomChange,
    SelectorChange,
    StoreChange,
} from "./types/StoreChange"
export type { StoreChangeCallback } from "./types/StoreChangeCallback"
export type { StoreChangeMeta } from "./types/StoreChangeMeta"
export type { StoreChangeSource } from "./types/StoreChangeSource"
export type { Transaction } from "./types/Transaction"
export type { TransactionFn } from "./types/TransactionFn"
export type { TransactionInterface } from "./types/TransactionInterface"
