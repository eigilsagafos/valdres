import { onDestroy } from "svelte"
import type { Store } from "valdres"
import { getValdresContext, setValdresContext } from "./context"

const generateId = () => (Math.random() + 1).toString(36).substring(7)

export const scope = (scopeId: string = generateId()): Store => {
    const parentStore = getValdresContext()
    const scopeCreated = !parentStore.data.scopes?.has(scopeId)
    const scopedStore = parentStore.scope(scopeId)
    setValdresContext(scopedStore)
    onDestroy(() => scopedStore.detach(scopeCreated))
    return scopedStore
}
