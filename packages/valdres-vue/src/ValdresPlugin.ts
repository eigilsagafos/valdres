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
        if (!store) {
            store = createStore()
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
