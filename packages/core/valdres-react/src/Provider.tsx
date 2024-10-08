import { useContext, useRef, type ReactNode } from "react"
import { createStore, type Store, type Atom, type State } from "valdres"
import { StoreContext, type ProviderContext } from "./lib/StoreContext"

type InitializeCallback = () => [Atom, any][]

const hydrate = (store: Store, state: [State, any][]) =>
    state.map(([atom, value]) => {
        store.data.values.set(atom, value)
    })

const initStore = (
    parentContext: ProviderContext | undefined,
    store = createStore(),
    initialize?: InitializeCallback,
) => {
    if (initialize) hydrate(store, initialize())
    if (parentContext) {
        const [, stores] = parentContext
        if (store.data.id in stores) {
            throw new Error(
                `store with id ${store.data.id} is already defined further up the tree`,
            )
        }
        return [
            store.data.id,
            {
                ...stores,
                [store.data.id]: store,
            },
        ]
    }
    return [
        store.data.id,
        {
            [store.data.id]: store,
        },
    ] as ProviderContext
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
