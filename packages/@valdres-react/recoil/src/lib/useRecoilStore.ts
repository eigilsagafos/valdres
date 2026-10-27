import { useContext } from "react"
import type { Store } from "valdres"
import { useStore } from "valdres-react"
import { RecoilStoreContext } from "./RecoilStoreContext"

// valdres-react's StoreContext is private; `useStore` is its public reader
// and throws exactly this when no Provider is above the component.
const NO_PROVIDER = "valdres-react: no Store was provided."

const useProviderStore = (): Store | undefined => {
    try {
        return useStore()
    } catch (error) {
        if (error instanceof Error && error.message.startsWith(NO_PROVIDER))
            return undefined
        throw error
    }
}

/**
 * The Store the Recoil hooks use: the nearest `<RecoilRoot>`'s, else (a
 * Valdres extension) the nearest valdres-react `<Provider>`'s. There is no
 * default Store, and a Provider's Store is used as is, never created or
 * disposed here.
 */
export const useRecoilStore = (): Store => {
    const root = useContext(RecoilStoreContext)
    const provided = useProviderStore()
    const store = root ?? provided
    if (store === undefined)
        throw new Error(
            "This component must be used inside a <RecoilRoot> component or a valdres-react <Provider>.",
        )
    return store
}
