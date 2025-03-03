import { version } from "../package.json" assert { type: "json" }

declare global {
    var __valdres__: string
}
if (globalThis.__valdres__) {
    throw new Error(
        `Error! An instance of valdres is already loaded. Loaded: ${globalThis.__valdres__}. Attempted to load: ${version}`,
    )
} else {
    globalThis.__valdres__ = version
}

export { atom } from "./atom"
export { atomFamily } from "./atomFamily"
export { createStoreWithSelectorSet } from "./createStoreWithSelectorSet"
export { globalStore } from "./globalStore"
export { index } from "./indexConstructor"
export { selector } from "./selector"
export { selectorFamily } from "./selectorFamily"
export { store } from "./store"

export { deepFreeze } from "./utils/deepFreeze"
export { isAtom } from "./utils/isAtom"
export { isAtomFamily } from "./utils/isAtomFamily"
export { isFamily } from "./utils/isFamily"
export { isFamilyAtom } from "./utils/isFamilyAtom"
export { isFamilySelector } from "./utils/isFamilySelector"
export { isFamilyState } from "./utils/isFamilyState"
export { isPromiseLike } from "./utils/isPromiseLike"
export { isSelector } from "./utils/isSelector"
export { isSelectorFamily } from "./utils/isSelectorFamily"

export type { Atom } from "./types/Atom"
export type { AtomFamily } from "./types/AtomFamily"
export type { FamilyKey } from "./types/FamilyKey"
export type { GetValue } from "./types/GetValue"
export type { GlobalAtom } from "./types/GlobalAtom"
export type { ResetAtom } from "./types/ResetAtom"
export type { Selector } from "./types/Selector"
export type { SelectorFamily } from "./types/SelectorFamily"
export type { SetAtom } from "./types/SetAtom"
export type { SetAtomValue } from "./types/SetAtomValue"
export type { State } from "./types/State"
export type { Store } from "./types/Store"
export type { StoreData } from "./types/StoreData"
export type { TransactionFn } from "./types/TransactionFn"
export type { TransactionInterface } from "./types/TransactionInterface"
