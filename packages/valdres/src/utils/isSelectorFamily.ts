import type { SelectorFamily } from "../types/SelectorFamily"

export const isSelectorFamily = (state: any): state is SelectorFamily =>
    state && Object.hasOwn(state, "__valdresSelectorFamilyMap")
