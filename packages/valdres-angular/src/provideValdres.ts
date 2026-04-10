import { makeEnvironmentProviders } from "@angular/core"
import { store as createStore, type Store } from "valdres"
import { VALDRES_STORE } from "./lib/VALDRES_STORE"
import { hydrate } from "./lib/hydrate"
import type { InitializeCallback } from "./types/InitializeCallback"

export interface ValdresOptions {
    store?: Store
    initialize?: InitializeCallback
}

export const provideValdres = (options: ValdresOptions = {}) => {
    return makeEnvironmentProviders([
        {
            provide: VALDRES_STORE,
            useFactory: () => {
                let store = options.store
                if (store) {
                    if (!store.data.batchUpdates) {
                        console.warn(
                            "valdres-angular: The store passed to provideValdres() was not created " +
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
                return {
                    current: store,
                    stores: { [store.data.id]: store },
                }
            },
        },
    ])
}
