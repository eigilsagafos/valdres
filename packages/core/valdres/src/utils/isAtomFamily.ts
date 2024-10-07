import type { AtomFamily } from "../types/AtomFamily"

export const isAtomFamily = (state: any): state is AtomFamily =>
    state && Object.hasOwn(state, "__valdresAtomFamilyMap")
