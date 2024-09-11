import { useValdresValue } from "../../valdres-react"
import { registerListeners } from "./registerListeners"
import { activeKeysSelector } from "./activeKeysSelector"

export const useActiveKeys = () => {
    registerListeners()
    const keys = useValdresValue(activeKeysSelector)
    // console.log(keys)
    return keys
}
