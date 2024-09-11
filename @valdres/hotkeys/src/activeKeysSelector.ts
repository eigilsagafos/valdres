import { selector } from "../../valdres"
import { keyStatusAtomFamily } from "./keyStatusAtomFamily"

export const activeKeysSelector = selector(get => {
    return get(keyStatusAtomFamily)
        .filter(([k, e]) => e.type === "keydown")
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .map(([k, v]) => v)
})
