import { useContext, onCleanup, type JSX } from "solid-js"
import { StoreContext } from "./lib/storeContext"
import { hydrate } from "./lib/hydrate"
import type { InitializeCallback } from "./types/InitializeCallback"

const generateId = () => (Math.random() + 1).toString(36).substring(7)

export interface ValdresScopeProps {
    scopeId?: string
    initialize?: InitializeCallback
    children: JSX.Element
}

export const ValdresScope = (props: ValdresScopeProps) => {
    const parentCtx = useContext(StoreContext)
    if (!parentCtx) {
        throw new Error(
            "No valdres store found. ValdresScope must be nested under a <ValdresProvider>.",
        )
    }

    const scopeId = props.scopeId || generateId()
    const scopeCreated = !parentCtx.current.data.scopes?.has(scopeId)
    const scopedStore = parentCtx.current.scope(scopeId)

    if (props.initialize) {
        scopedStore.txn(txn => {
            const pairs = props.initialize!(txn)
            if (pairs) {
                hydrate(txn.set, pairs)
            }
        })
    }

    onCleanup(() => {
        scopedStore?.detach?.(scopeCreated)
    })

    return (
        <StoreContext.Provider
            value={{
                current: scopedStore,
                stores: {
                    ...parentCtx.stores,
                    [parentCtx.current.data.id]: parentCtx.current,
                    [scopedStore.data.id]: scopedStore,
                },
            }}
        >
            {props.children}
        </StoreContext.Provider>
    )
}
