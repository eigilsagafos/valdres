import { useValdresValue } from "../../valdres-react"
import { registerListeners } from "./registerListeners"
import { activeKeysSelector } from "./activeKeysSelector"

export const useActiveKeyNames = () => {
    registerListeners()
    const keys = useValdresValue(activeKeysSelector)
    // console.log(keys)
    return keys.map(key => key.key)
}
