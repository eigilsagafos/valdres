import { useValue } from "../../valdres-react"
import { registerListeners } from "./registerListeners"
import { activeKeysSelector } from "./activeKeysSelector"

export const useActiveKeyNames = () => {
    registerListeners()
    const keys = useValue(activeKeysSelector)
    // console.log(keys)
    return keys.map(key => key.key)
}
