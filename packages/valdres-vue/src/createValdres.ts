import type { App } from "vue"
import {
    store as createStore,
    hydrate as hydrateStore,
    setAtomPairs,
    type DehydratedState,
    type HydrateOptions,
    type InitializeCallback,
    type Store,
} from "valdres"
import { ValdresKey } from "./lib/storeKey"

/** Options for {@link createValdres}. All optional — the no-arg form
 *  auto-creates a per-instance store. */
export interface ValdresOptions {
    /** Use this store instead of auto-creating one. Warns when it was not
     *  created with `{ batchUpdates: true }` (sequential `store.set()` calls
     *  would then trigger intermediate selector evaluations). */
    store?: Store
    /** Seed the store inside a transaction before any component reads it. Runs
     *  before `hydrate`, so transferred server values win over local defaults. */
    initialize?: InitializeCallback
    /** A `dehydrate(store)` payload (e.g. arriving from the SSR `nuxtApp.payload`)
     *  to apply to the freshly-created store via core `hydrate`. */
    hydrate?: DehydratedState
    /** Forwarded to core `hydrate` — `{ invalid: "throw" | "skip" }`
     *  (default strict: throw). */
    hydrateOptions?: HydrateOptions
}

/** A valdres instance — the Vue plugin plus a handle on its store. Mirrors the
 *  Pinia instance shape (`createPinia()` returns `{ install, state, ... }`):
 *  `install` registers the store on the app, and `store` is the same store for
 *  direct access (read it on the server, `dehydrate` it into the SSR payload). */
export interface Valdres {
    install(app: App): void
    store: Store
}

/** [Docs Reference](https://valdres.dev/vue/createValdres)
 *
 * Create a valdres instance for a Vue app — the Pinia-shaped registration entry
 * point. The store is created in the `createValdres()` body (not inside
 * `install`), so `valdres.store` is available immediately — `app.use(valdres)`
 * then provides it to every component:
 *
 * ```ts
 * const valdres = createValdres()
 * createApp(App).use(valdres).mount("#app")
 * ```
 *
 * **SSR / Nuxt.** Create one instance per request (never share a store across
 * requests — module-level state would leak between users). On the server,
 * `dehydrate(valdres.store)` into the transferable payload; on the client, pass
 * it back as `hydrate`:
 *
 * ```ts
 * // server
 * const valdres = createValdres()
 * app.use(valdres)
 * // …render…
 * nuxtApp.payload.valdres = dehydrate(valdres.store)
 *
 * // client
 * const valdres = createValdres({ hydrate: nuxtApp.payload.valdres })
 * ```
 *
 * Core `hydrate` opens its own transaction and resolves atom names through the
 * global registry; only `name`d atoms/families transfer, and an unknown name
 * (its defining module not yet imported under code-splitting) is warn-skipped.
 * Atoms carrying a codec schema round-trip `BigInt`/`Date`/`Map`/`Set` over
 * plain JSON automatically — no Vue-side serializer needed. When both
 * `initialize` and `hydrate` are given, `initialize` runs first so hydrated
 * values win.
 */
export const createValdres = (options: ValdresOptions = {}): Valdres => {
    let store = options.store
    if (store) {
        if (!store.data.batchUpdates) {
            console.warn(
                "valdres-vue: The store passed to createValdres() was not " +
                    "created with { batchUpdates: true }. Sequential store.set() " +
                    "calls will trigger intermediate selector evaluations. " +
                    "Consider using store({ batchUpdates: true }).",
            )
        }
    } else {
        store = createStore({ batchUpdates: true })
    }

    // initialize first (so transferred values from hydrate win), then hydrate.
    // Array.isArray (not truthiness): a single-expression `initialize` that
    // wrote through txn.set returns a non-array, which must not reach
    // setAtomPairs. (Switches to core's applyInitialize once #195 lands.)
    if (options.initialize) {
        store.txn(txn => {
            const pairs = options.initialize!(txn)
            if (Array.isArray(pairs)) setAtomPairs(txn.set, pairs)
        })
    }
    if (options.hydrate) {
        hydrateStore(store, options.hydrate, options.hydrateOptions)
    }

    const resolvedStore = store
    return {
        store: resolvedStore,
        install(app: App) {
            app.provide(ValdresKey, {
                current: resolvedStore,
                stores: { [resolvedStore.data.id]: resolvedStore },
            })
        },
    }
}
