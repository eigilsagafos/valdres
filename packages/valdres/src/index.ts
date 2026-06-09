declare global {
    var __valdres__: string
}
// `process.env.VALDRES_VERSION` is statically replaced at build time by
// Bun.build's define option. Declared at module scope (not global) so we
// don't conflict with consumers' @types/node or bun-types.
declare const process: { env: { VALDRES_VERSION?: string } }
if (globalThis.__valdres__) {
    throw new Error(
        `Error! An instance of valdres is already loaded. Loaded: ${globalThis.__valdres__}. Attempted to load: ${process.env.VALDRES_VERSION}`,
    )
} else {
    globalThis.__valdres__ = process.env.VALDRES_VERSION as string
}

export { atom } from "./atom"
export { atomFamily } from "./atomFamily"
export { atomFamilyIndex } from "./atomFamilyIndex"
export { atomFamilySearch } from "./atomFamilySearch"
export { atomFamilySort } from "./atomFamilySort"
export { cacheMeta } from "./cacheMeta"
export { globalStore } from "./globalStore"
export { index } from "./indexConstructor"
export { selector } from "./selector"
export { selectorFamily } from "./selectorFamily"
export { store } from "./store"

export { defaultTokenize } from "./utils/defaultTokenize"
export { deepFreeze } from "./utils/deepFreeze"
export { englishStopWords } from "./utils/englishStopWords"
export { foldAccents } from "./utils/foldAccents"
export { simpleEnglishStem } from "./utils/simpleEnglishStem"
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
// Search internals exposed as public utilities (used by atomFamilySearch,
// useful standalone). Exported from lib/ alongside the existing
// isSuspendError / Transaction precedent.
export { bm25Score, DEFAULT_BM25 } from "./lib/bm25"
export { levenshtein } from "./lib/levenshtein"

export type { BM25Params } from "./lib/bm25"
export type {
    AtomFamilySearch,
    AtomFamilySearchOptions,
    LanguagePreset,
    MatchStrategy,
    ScoredResult,
    SearchLanguage,
    SearchMode,
} from "./atomFamilySearch"
export type { CacheMeta } from "./cacheMeta"
export type { Atom } from "./types/Atom"
export type { AtomFamily } from "./types/AtomFamily"
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
