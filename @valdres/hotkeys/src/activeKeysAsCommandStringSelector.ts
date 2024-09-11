import { selector } from "../../valdres"
import { activeKeysSelector } from "./activeKeysSelector"

export const activeKeysAsCommandStringSelector = selector(get => {
    return get(activeKeysSelector)
        .map(event => {
            switch (event.code) {
                case "MetaLeft":
                case "MetaRight":
                    return "Meta"
                default:
                    return event.code
            }
        })
        .join("+")
})
