import { useContext } from "react"
import type { Store } from "valdres"
import { RecoilStoreContext } from "./RecoilStoreContext"

export const useRecoilStore = (): Store => {
    const store = useContext(RecoilStoreContext)
    if (store === undefined)
        throw new Error(
            "This component must be used inside a <RecoilRoot> component.",
        )
    return store
}
