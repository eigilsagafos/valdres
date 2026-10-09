import { useContext, useState, type ReactElement, type ReactNode } from "react"
import { store as createStore, type Store } from "valdres"
import { Provider } from "valdres-react"
import { RecoilStoreContext } from "./lib/RecoilStoreContext"
import { mutableSnapshot } from "./lib/snapshot"
import type { MutableSnapshot } from "./types/MutableSnapshot"
import type { RecoilRootProps } from "./types/RecoilRootProps"

type InitializeState = (mutableSnapshot: MutableSnapshot) => void

const createRootStore = (initializeState: InitializeState | undefined): Store => {
    const store = createStore()
    if (initializeState !== undefined) {
        store.txn(tx => {
            let open = true
            try {
                initializeState(mutableSnapshot(tx, () => open))
            } finally {
                open = false
            }
        })
    }
    return store
}

const OwnedRoot = ({
    initializeState,
    children,
}: {
    initializeState?: InitializeState
    children?: ReactNode
}): ReactElement => {
    // Created once per mounted root, during its first render, as Recoil does.
    // The Store holds no external resources and is released with the root.
    const [store] = useState(() => createRootStore(initializeState))
    return (
        <RecoilStoreContext.Provider value={store}>
            <Provider store={store}>{children}</Provider>
        </RecoilStoreContext.Provider>
    )
}

/**
 * Recoil's `<RecoilRoot>`: owns a new Valdres Store for its subtree, runs
 * `initializeState` once against it, and also provides it to `valdres-react`
 * hooks. Nested roots are independent unless `override={false}`, which reuses
 * the nearest ancestor root.
 */
export const RecoilRoot = (props: RecoilRootProps): ReactElement => {
    const ancestor = useContext(RecoilStoreContext)
    if (props.override === false && ancestor !== undefined)
        return <>{props.children}</>
    return (
        <OwnedRoot
            initializeState={"initializeState" in props ? props.initializeState : undefined}
        >
            {props.children}
        </OwnedRoot>
    )
}
