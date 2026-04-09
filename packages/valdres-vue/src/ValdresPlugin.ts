import type { App, Plugin } from "vue"
import { store as createStore, type Store } from "valdres"
import { StoreKey } from "./lib/storeKey"
import { hydrate } from "./lib/hydrate"
import type { InitializeCallback } from "./types/InitializeCallback"

export interface ValdresPluginOptions {
    store?: Store
    initialize?: InitializeCallback
}

export const ValdresPlugin: Plugin = {
    install(app: App, options: ValdresPluginOptions = {}) {
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
        app.provide(StoreKey, store)
    },
}
