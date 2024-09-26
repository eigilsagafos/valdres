import { useValdresState } from "valdres-react"

export const useAtom = state => {
    return useValdresState(state)
}
