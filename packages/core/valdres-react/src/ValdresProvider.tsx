import { useRef, type ReactNode } from "react"
import { createStore, type Store, type Atom } from "../../valdres"
import { StoreContext } from "./lib/StoreContext"

type InitializeCallback = () => [Atom, any][]

const hydrate = (store: Store, state) =>
    state.map(([atom, value]) => {
        store.data.values.set(atom, value)
    })

const initStore = (store = createStore(), initialize?: InitializeCallback) => {
    if (initialize) hydrate(store, initialize())
    return store
}

export const ValdresProvider = ({
    children,
    store,
    initialize,
}: {
    children?: ReactNode
    store?: Store
    initialize?: InitializeCallback
}) => {
    const storeRef = useRef<Store>(initStore(store, initialize))
    return (
        <StoreContext.Provider value={storeRef.current}>
            {children}
        </StoreContext.Provider>
    )
}
