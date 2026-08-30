import type { ReactElement, ReactNode } from "react"
import type { Store } from "valdres"
import { assertStore } from "valdres/adapter-internals/v1"
import { StoreContext } from "./lib/StoreContext"

interface ProviderProps {
    readonly store: Store
    readonly children?: ReactNode
}

export const Provider = ({ store, children }: ProviderProps): ReactElement => {
    assertStore(store)
    return (
        <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
    )
}
