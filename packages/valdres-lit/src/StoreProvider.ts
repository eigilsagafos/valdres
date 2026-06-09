import type { ReactiveController, ReactiveElement } from "lit"
import { ContextProvider } from "@lit/context"
import { store as createStore, type Store } from "valdres"
import { valdresContext } from "./lib/valdresContext"

export class StoreProvider implements ReactiveController {
    private _store: Store
    private _provider: ContextProvider<typeof valdresContext>

    constructor(host: ReactiveElement, store?: Store) {
        // Zero-config path: auto-create a batched store, matching the React,
        // Solid, Vue and Angular providers. Only an explicitly supplied store
        // that opted out of batching triggers the warning.
        if (store && !store.data.batchUpdates) {
            console.warn(
                "valdres-lit: store passed to StoreProvider was not created " +
                    "with { batchUpdates: true }. Sequential store.set() calls " +
                    "will trigger intermediate selector evaluations. Consider " +
                    "store({ batchUpdates: true }) for optimal performance.",
            )
        }
        this._store = store ?? createStore({ batchUpdates: true })
        host.addController(this)
        this._provider = new ContextProvider(host, {
            context: valdresContext,
            initialValue: this._store,
        })
    }

    get store(): Store {
        return this._store
    }

    setStore(store: Store) {
        this._store = store
        this._provider.setValue(store)
    }
}
