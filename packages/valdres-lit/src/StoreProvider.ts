import type { ReactiveController, ReactiveElement } from "lit"
import { ContextProvider } from "@lit/context"
import type { Store } from "valdres"
import { valdresContext } from "./lib/valdresContext"

export class StoreProvider implements ReactiveController {
    private _provider: ContextProvider<typeof valdresContext>

    constructor(host: ReactiveElement, store: Store) {
        if (!store.data.batchUpdates) {
            console.warn(
                "valdres-lit: store provided to StoreProvider was not created " +
                    "with { batchUpdates: true }. Sequential store.set() calls " +
                    "will trigger intermediate selector evaluations. Consider " +
                    "store({ batchUpdates: true }) for optimal performance.",
            )
        }
        host.addController(this)
        this._provider = new ContextProvider(host, {
            context: valdresContext,
            initialValue: store,
        })
    }

    hostConnected() {}

    setStore(store: Store) {
        this._provider.setValue(store)
    }
}
