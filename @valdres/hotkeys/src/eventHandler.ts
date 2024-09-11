import { getDefaultStore } from "../../valdres"
import { keyStatusAtomFamily } from "./keyStatusAtomFamily"
import { activeKeysAsCommandStringSelector } from "./activeKeysAsCommandStringSelector"
import { callbacks } from "./callbacks"
import { activeKeysSelector } from "./activeKeysSelector"

export const eventHandler = (keyboardEvent: KeyboardEvent) => {
    const { key, code, type, timeStamp } = keyboardEvent
    const event = { key, code, type, timeStamp }
    const store = getDefaultStore()
    store.set(keyStatusAtomFamily(event.code), { ...event })
    if (event.type === "keydown") {
        // store.set(keyStatusAtomFamily(event.code), event)
        const command = store.get(activeKeysAsCommandStringSelector)
        if (callbacks.has(command)) {
            keyboardEvent.preventDefault()
            keyboardEvent.stopPropagation()
            const commandCallbacks = callbacks.get(command)
            commandCallbacks.forEach(cb => cb())
        }
    }
    if (event.type === "keyup") {
        const active = store.get(activeKeysSelector)
        if (event.key === "Meta") {
            active.forEach(active => {
                if (active.key !== "Meta") {
                    store.set(keyStatusAtomFamily(active.code), curr => ({
                        ...curr,
                        type: "keyup",
                    }))

                    console.log(`up meta`, active)
                }
            })
        }
    }
}
