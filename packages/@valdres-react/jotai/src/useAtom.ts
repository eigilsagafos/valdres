import { useAtom as useValdresAtom } from "valdres-react"
import { useStore } from "./useStore"

export const useAtom = state => {
    const store = useStore()
    return useValdresAtom(state, store)
}
