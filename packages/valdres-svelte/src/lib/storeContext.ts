import type { Store } from "valdres"

/** The shape stored under {@link VALDRES_CONTEXT_KEY} — the same
 *  `{ current, stores }` context the other framework adapters use. `current` is
 *  the store the nearest provider/scope set; `stores` maps every store id in
 *  the tree to its store (kept for parity with the sibling adapters; may stay
 *  unconsumed for now). */
export interface ValdresContext {
    current: Store
    stores: Record<string, Store>
}

/** Svelte context key for the valdres store tree. A `Symbol.for(...)` instead
 *  of a bare string so it can't collide with an unrelated `setContext("...")`,
 *  while staying tolerant of the dual-package hazard (a registered symbol is
 *  shared across module instances). */
export const VALDRES_CONTEXT_KEY = Symbol.for("valdres")
