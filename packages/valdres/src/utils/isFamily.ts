import { isAtomFamily } from "./isAtomFamily"
import { isSelectorFamily } from "./isSelectorFamily"

export const isFamily = (state: any) =>
    isAtomFamily(state) || isSelectorFamily(state)
