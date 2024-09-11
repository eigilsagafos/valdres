import { useCallback } from "react"
import { useValdresStore } from "./useValdresStore"

export const useValdresCallback = (callback, dependencies = []) => {
    const store = useValdresStore()
    // const cachedFn = useCallback(callback, dependencies)
    return useCallback((args) => {
        return callback({
            set: store.set,
            reset: () => {
                throw new Error(`rtoo`)
            },
            snapshot: {
                getLoadable: (atom) => {
                    return { contents: store.get(atom) }
                },
            },
        })(args)
    }, dependencies)
}
