import { useContext, useEffect, useMemo, type ReactNode } from "react"
import { StoreContext } from "./lib/StoreContext"
import type { InitializeCallback } from "./types/InitializeCallback"
import { hydrate } from "./lib/hydrate"

type ScopeArgs = {
    scopeId?: string
    children?: ReactNode
    initialize?: InitializeCallback
}

const generateId = () => (Math.random() + 1).toString(36).substring(7)

export const Scope = ({
    scopeId = generateId(),
    children,
    initialize,
}: ScopeArgs) => {
    const [currentStore, allStores] = useContext(StoreContext)
    if (!currentStore)
        throw new Error(
            "No <Provider> in tree. <Scope> has to be nested under a <Provider> to work",
        )
    const scopedStore = useMemo(() => {
        const store = currentStore.scope(scopeId)
        if (initialize) {
            store.txn(txn => {
                const pairs = initialize(txn)
                if (pairs) {
                    hydrate(txn.set, pairs)
                }
            })
        }
        return store
    }, [scopeId, currentStore])

    useEffect(() => {
        if ("detach" in scopedStore) {
            return scopedStore.detach
        }
    }, [scopedStore, scopeId, currentStore])

    return (
        <StoreContext.Provider value={[scopedStore, allStores]}>
            {children}
        </StoreContext.Provider>
    )
}
