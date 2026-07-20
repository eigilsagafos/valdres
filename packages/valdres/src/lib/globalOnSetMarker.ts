import type { AtomOnSet } from "../types/AtomOnSet"

/** Shared slow-path marker for global atoms without a user onSet hook. */
export const globalOnSetMarker: AtomOnSet<any> = () => {}
