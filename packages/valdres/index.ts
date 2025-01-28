import { version } from "./package.json"

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

export { atom } from "./src/atom"
export { atomFamily } from "./src/atomFamily"
export { createStoreWithSelectorSet } from "./src/createStoreWithSelectorSet"
export { globalStore } from "./src/globalStore"
export { selector } from "./src/selector"
export { selectorFamily } from "./src/selectorFamily"
export { store } from "./src/store"

export { isAtom } from "./src/utils/isAtom"
export { isAtomFamily } from "./src/utils/isAtomFamily"
export { isFamily } from "./src/utils/isFamily"
export { isFamilyAtom } from "./src/utils/isFamilyAtom"
export { isFamilySelector } from "./src/utils/isFamilySelector"
export { isFamilyState } from "./src/utils/isFamilyState"
export { isPromiseLike } from "./src/utils/isPromiseLike"
export { isSelector } from "./src/utils/isSelector"
export { isSelectorFamily } from "./src/utils/isSelectorFamily"

export type { Atom } from "./src/types/Atom"
export type { AtomFamily } from "./src/types/AtomFamily"
export type { FamilyKey } from "./src/types/FamilyKey"
export type { GetValue } from "./src/types/GetValue"
export type { GlobalAtom } from "./src/types/GlobalAtom"
export type { ResetAtom } from "./src/types/ResetAtom"
export type { Selector } from "./src/types/Selector"
export type { SelectorFamily } from "./src/types/SelectorFamily"
export type { SetAtom } from "./src/types/SetAtom"
export type { SetAtomValue } from "./src/types/SetAtomValue"
export type { State } from "./src/types/State"
export type { Store } from "./src/types/Store"
export type { StoreData } from "./src/types/StoreData"
export type { TransactionFn } from "./src/types/TransactionFn"
export type { TransactionInterface } from "./src/types/TransactionInterface"
