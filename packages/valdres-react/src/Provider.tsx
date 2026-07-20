import { useContext, useRef, type ReactNode } from "react"
import { store as createStore, type Store } from "valdres"
import { storeAdapter } from "valdres/adapter-internals/v1"
import { StoreContext, type ProviderContext } from "./lib/StoreContext"
import type { InitializeCallback } from "./types/InitializeCallback"
import { hydrate } from "./lib/hydrate"

const initStore = (
    parentContext: ProviderContext | undefined,
    store?: Store,
    initialize?: InitializeCallback,
) => {
    if (store) {
        if (!storeAdapter.isBatching(store)) {
            console.warn(
                "valdres-react: The store passed to <Provider> was not created " +
                    "with { batchUpdates: true }. Sequential store.set() calls " +
                    "will trigger intermediate selector evaluations. Consider " +
                    "using store({ batchUpdates: true }) for optimal React performance.",
            )
        }
    } else {
        store = createStore({ batchUpdates: true })
    }
    if (initialize) {
        store.txn(txn => {
            const pairs = initialize(txn)
            if (pairs) {
                hydrate(txn.set, pairs)
            }
        })
    }
    if (parentContext) {
        const [, allStores] = parentContext
        if (store.id in allStores) {
            throw new Error(
                `store with id ${store.id} is already defined further up the tree`,
            )
        }
        return [
            store,
            {
                ...allStores,
                [store.id]: store,
            },
        ]
    }
    return [
        store,
        {
            [store.id]: store,
        },
    ]
}

type ProviderArgs = {
    children?: ReactNode
    store?: Store
    initialize?: InitializeCallback
}

export const Provider = ({ children, store, initialize }: ProviderArgs) => {
    const existing = useContext(StoreContext)
    const storeRef = useRef<ProviderContext>(
        // @ts-ignore @ts-todo
        initStore(existing, store, initialize),
    )
    return (
        <StoreContext.Provider value={storeRef.current}>
            {children}
        </StoreContext.Provider>
    )
}
