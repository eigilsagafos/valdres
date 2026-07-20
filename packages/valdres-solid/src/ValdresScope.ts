import { useContext, onCleanup, createUniqueId, type JSX } from "solid-js"
import { storeAdapter } from "valdres/adapter-internals/v1"
import { StoreContext } from "./lib/storeContext"
import { hydrate } from "./lib/hydrate"
import type { InitializeCallback } from "./types/InitializeCallback"

export interface ValdresScopeProps {
    scopeId?: string
    initialize?: InitializeCallback
    children: JSX.Element
}

export const ValdresScope = (props: ValdresScopeProps) => {
    const parentCtx = useContext(StoreContext)
    if (!parentCtx) {
        throw new Error(
            "No valdres store found. ValdresScope must be nested under a <ValdresProvider> or another <ValdresScope>.",
        )
    }

    const scopeId = props.scopeId || createUniqueId()
    const scopeCreated = !storeAdapter.hasScope(parentCtx.current, scopeId)
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

    return StoreContext.Provider({
        value: {
            current: scopedStore,
            stores: {
                ...parentCtx.stores,
                [parentCtx.current.id]: parentCtx.current,
                [scopedStore.id]: scopedStore,
            },
        },
        get children() {
            return props.children
        },
    })
}
