import { getContext } from "svelte"
import type { Store } from "valdres"
import { VALDRES_CONTEXT_KEY, type ValdresContext } from "./lib/storeContext"

/** Read the current valdres store from Svelte context — the store set by the
 *  nearest `setValdresContext`/`scope` ancestor.
 *
 *  Must be called during component initialization (Svelte throws
 *  `lifecycle_outside_component` for `getContext` outside init); to use the
 *  store in an event handler or other deferred callback, capture it at init or
 *  use {@link transaction}. Throws if no provider is set up the tree. */
export const getValdresContext = (): Store => {
    const ctx = getContext<ValdresContext | undefined>(VALDRES_CONTEXT_KEY)
    if (!ctx)
        throw new Error(
            "No valdres store found in context. Did you call setValdresContext() in a parent component?",
        )
    return ctx.current
}
