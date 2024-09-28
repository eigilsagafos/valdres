import { useAtom as useValdresAtom } from "valdres-react"

export const useAtom = state => {
    return useValdresAtom(state)
}
