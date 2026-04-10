import { type JSX } from "solid-js"
import { store as createStore, type Store } from "valdres"
import { StoreContext } from "./lib/storeContext"
import { hydrate } from "./lib/hydrate"
import type { InitializeCallback } from "./types/InitializeCallback"

export interface ValdresProviderProps {
    store?: Store
    initialize?: InitializeCallback
    children: JSX.Element
}

export const ValdresProvider = (props: ValdresProviderProps) => {
    let store = props.store
    if (store) {
        if (!store.data.batchUpdates) {
            console.warn(
                "valdres-solid: The store passed to ValdresProvider was not created " +
                    "with { batchUpdates: true }. Sequential store.set() calls " +
                    "will trigger intermediate selector evaluations. Consider " +
                    "using store({ batchUpdates: true }) for optimal performance.",
            )
        }
    } else {
        store = createStore({ batchUpdates: true })
    }

    if (props.initialize) {
        store.txn(txn => {
            const pairs = props.initialize!(txn)
            if (pairs) {
                hydrate(txn.set, pairs)
            }
        })
    }

    return (
        <StoreContext.Provider
            value={{
                current: store,
                stores: { [store.data.id]: store },
            }}
        >
            {props.children}
        </StoreContext.Provider>
    )
}
