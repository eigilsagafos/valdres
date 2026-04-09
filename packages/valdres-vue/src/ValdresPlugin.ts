import type { Plugin } from "vue"
import { store as createStore, type Store } from "valdres"
import { ValdresKey } from "./lib/storeKey"
import { hydrate } from "./lib/hydrate"
import type { InitializeCallback } from "./types/InitializeCallback"

export interface ValdresPluginOptions {
    store?: Store
    initialize?: InitializeCallback
}

export const createValdres = (options: ValdresPluginOptions = {}): Plugin => ({
    install(app) {
        let store = options.store
        if (store) {
            if (!store.data.batchUpdates) {
                console.warn(
                    "valdres-vue: The store passed to createValdres() was not created " +
                    "with { batchUpdates: true }. Sequential store.set() calls " +
                    "will trigger intermediate selector evaluations. Consider " +
                    "using store({ batchUpdates: true }) for optimal performance.",
                )
            }
        } else {
            store = createStore({ batchUpdates: true })
        }
        if (options.initialize) {
            store.txn(txn => {
                const pairs = options.initialize!(txn)
                if (pairs) {
                    hydrate(txn.set, pairs)
                }
            })
        }
        app.provide(ValdresKey, {
            current: store,
            stores: { [store.data.id]: store },
        })
    },
})
