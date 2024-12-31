import { useContext, useRef, type ReactNode } from "react"
import { store as createStore, type Store } from "valdres"
import { StoreContext, type ProviderContext } from "./lib/StoreContext"
import type { InitializeCallback } from "./types/InitializeCallback"
import { hydrate } from "./lib/hydrate"

const initStore = (
    parentContext: ProviderContext | undefined,
    store = createStore(),
    initialize?: InitializeCallback,
) => {
    if (initialize) {
        store.txn(({ set, get, reset, commit }) => {
            const txn = { set, get, reset, commit }
            // @ts-ignore
            const pairs = initialize(txn)
            if (pairs) {
                hydrate(set, pairs)
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
