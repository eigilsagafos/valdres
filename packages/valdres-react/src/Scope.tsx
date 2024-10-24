import { useContext, useEffect, useMemo, type ReactNode } from "react"
import { StoreContext } from "./lib/StoreContext"

type ScopeArgs = {
    scopeId?: string
    children?: ReactNode
}

const generateId = () => (Math.random() + 1).toString(36).substring(7)

export const Scope = ({ scopeId = generateId(), children }: ScopeArgs) => {
    const [currentStore, allStores] = useContext(StoreContext)
    if (!currentStore)
        throw new Error(
            "No <Provider> in tree. <Scope> has to be nested under a <Provider> to work",
        )
    const scopedStore = useMemo(
        () => currentStore.scope(scopeId),
        [scopeId, currentStore],
    )
    useEffect(() => {
        if ("detach" in scopedStore) {
            scopedStore.detach()
        }
    }, [scopedStore, scopeId, currentStore])

    return (
        <StoreContext.Provider value={[scopedStore, allStores]}>
            {children}
        </StoreContext.Provider>
    )
}
