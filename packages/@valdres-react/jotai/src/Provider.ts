import {
    createElement,
    useRef,
    type FunctionComponent,
    type ReactElement,
    type ReactNode,
} from "react"
import type { Store } from "./types/jotai"
import { createStore } from "./createStore"
import { StoreContext } from "./lib/StoreContext"

// Port of Jotai 3.0.1's Provider (MIT): without a `store` prop it owns a store
// created once per Provider instance.
export function Provider({
    children,
    store,
}: {
    children?: ReactNode
    store?: Store
}): ReactElement<
    { value: Store | undefined },
    FunctionComponent<{ value: Store | undefined }>
> {
    const storeRef = useRef<Store | null>(null)
    if (store) {
        return createElement(StoreContext.Provider, { value: store }, children)
    }
    if (storeRef.current === null) {
        storeRef.current = createStore()
    }
    return createElement(
        StoreContext.Provider,
        { value: storeRef.current },
        children,
    )
}
