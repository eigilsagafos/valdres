import type { SelectorFamily } from "../types/SelectorFamily"

export const isSelectorFamily = <K, V>(
    state: any,
): state is SelectorFamily<K, V> =>
    state && Object.hasOwn(state, "__valdresSelectorFamilyMap")
