import { getContext, setContext } from "svelte"
import {
    applyInitialize,
    store as createStore,
    hydrate as hydrateStore,
    type DehydratedState,
    type HydrateOptions,
    type InitializeCallback,
    type Store,
} from "valdres"
import { VALDRES_CONTEXT_KEY, type ValdresContext } from "./lib/storeContext"

/** Options for {@link setValdresContext}. All optional — the no-arg form
 *  auto-creates a per-tree store. */
export interface SetValdresContextOptions {
    /** Use this store instead of auto-creating one. Warns if it was not created
     *  with `{ batchUpdates: true }`. */
    store?: Store
    /** Seed the store inside a transaction before it's exposed. Runs before
     *  `hydrate` so transferred values win over local defaults. */
    initialize?: InitializeCallback
    /** A `dehydrate(store)` payload (e.g. arriving via SvelteKit `load` data)
     *  to apply to the freshly-created store. */
    hydrate?: DehydratedState
    /** Forwarded to core `hydrate` — `{ invalid: "throw" | "skip" }`
     *  (default strict: throw). */
    hydrateOptions?: HydrateOptions
}

const isStore = (value: unknown): value is Store =>
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    typeof (value as Store).txn === "function"

/** Create (or adopt) a valdres store and expose it to descendants via Svelte
 *  context — the root of the Svelte adapter's provider tier.
 *
 * The no-arg form creates `store({ batchUpdates: true })` per component tree,
 * which on the server means per SSR request — the canonical SvelteKit pattern
 * (call it in `+layout.svelte`) that avoids the module-level shared-store leak.
 * Pass a `Store` directly, or an options object to also `initialize` and/or
 * `hydrate` the store:
 *
 * ```svelte
 * <script lang="ts">
 *     import { setValdresContext } from "valdres-svelte"
 *     let { data, children } = $props()
 *     // +layout.server.ts returned plain serializable `data`; map it to atoms.
 *     setValdresContext({ initialize: txn => [[someAtom, data.x]] })
 * </script>
 * {@render children()}
 * ```
 *
 * When a payload from a dehydrated server store arrives through `load`, pass it
 * as `hydrate` — core `hydrate` opens its own transaction, so it runs as a
 * standalone commit on the fresh (not-yet-subscribed) store, after `initialize`.
 * Atoms carrying a codec schema round-trip `BigInt`/`Date`/`Map`/`Set` over
 * plain JSON automatically (core's wire codec) — no custom serializer needed.
 *
 * @returns the store now in context (handy for immediate use at init).
 */
export function setValdresContext(
    storeOrOptions?: Store | SetValdresContextOptions,
): Store {
    const options: SetValdresContextOptions = isStore(storeOrOptions)
        ? { store: storeOrOptions }
        : (storeOrOptions ?? {})

    let store = options.store
    if (store) {
        if (!store.data.batchUpdates) {
            console.warn(
                "valdres-svelte: The store passed to setValdresContext was not " +
                    "created with { batchUpdates: true }. Sequential store.set() " +
                    "calls will trigger intermediate selector evaluations. Consider " +
                    "using store({ batchUpdates: true }).",
            )
        }
    } else {
        store = createStore({ batchUpdates: true })
    }

    // initialize first (so transferred values from hydrate win), then hydrate.
    if (options.initialize) {
        store.txn(txn => applyInitialize(txn, options.initialize))
    }
    if (options.hydrate) {
        hydrateStore(store, options.hydrate, options.hydrateOptions)
    }

    const parentCtx = getContext<ValdresContext | undefined>(
        VALDRES_CONTEXT_KEY,
    )
    const ctx: ValdresContext = {
        current: store,
        stores: { ...(parentCtx?.stores ?? {}), [store.data.id]: store },
    }
    setContext(VALDRES_CONTEXT_KEY, ctx)
    return store
}
