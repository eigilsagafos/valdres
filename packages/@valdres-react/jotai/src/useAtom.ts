import { useMemo } from "react"
import { useAtom as useValdresAtom } from "valdres-react"
import { useStore } from "./useStore"

export const useAtom = (state: any) => {
    const store = useStore()
    // Use the raw (unwrapped) get for React hooks. The wrapped store.get
    // re-wraps resolved async values as Promises for jotai vanilla API compat,
    // but useValue throws any Promise for Suspense — causing infinite suspend.
    const reactStore = useMemo(() => {
        const rawGet = (store as any)._rawGet
        if (!rawGet) return store
        return { ...store, get: rawGet }
    }, [store])
    return useValdresAtom(state, reactStore)
}
