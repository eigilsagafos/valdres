import { useContext, useRef, type ReactNode } from "react"
import { store as createStore, type Store } from "valdres"
import { StoreContext, type ProviderContext } from "./lib/StoreContext"
import type { InitializeCallback } from "./types/InitializeCallback"
import { hydrate } from "./lib/hydrate"

const initStore = (
    parentContext: ProviderContext | undefined,
    store?: Store,
    initialize?: InitializeCallback,
) => {
    if (store) {
        if (!store.data.batchUpdates) {
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
        if (store.data.id in allStores) {
            throw new Error(
                `store with id ${store.data.id} is already defined further up the tree`,
            )
        }
        return [
            store,
            {
                ...allStores,
                [store.data.id]: store,
            },
        ]
    }
    return [
        store,
        {
            [store.data.id]: store,
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
