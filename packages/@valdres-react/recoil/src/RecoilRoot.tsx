import { useMemo } from "react"
import { createStoreWithSelectorSet, Provider } from "valdres-react"
import type {
    MutableSnapshot,
    RecoilRoot as RecoilRoot_original,
    ResetRecoilState,
    SetRecoilState,
} from "recoil"

export const RecoilRoot: typeof RecoilRoot_original = ({
    children,
    initializeState,
}: {
    children: React.ReactNode
    initializeState?: (mutableSnapshot: MutableSnapshot) => void
}) => {
    const store = useMemo(() => {
        const store = createStoreWithSelectorSet()

        if (initializeState) {
            store.txn((set, _get, reset) => {
                initializeState({
                    set: set as SetRecoilState,
                    getLoadable: state => {
                        return {
                            contents: store.get(state as any),
                        } as any
                    },
                    reset: reset as ResetRecoilState,
                    getID: () => {
                        throw new Error("Not implemented")
                    },
                    getPromise: () => {
                        throw new Error("Not implemented")
                    },
                    getNodes_UNSTABLE: () => {
                        throw new Error("Not implemented")
                    },
                    getInfo_UNSTABLE: () => {
                        throw new Error("Not implemented")
                    },
                    map: undefined as any,
                    asyncMap: undefined as any,
                    retain: undefined as any,
                    isRetained: undefined as any,
                })
            })
        }
        return store
    }, [])
    return <Provider store={store}>{children}</Provider>
}
