import { store } from "./store"
import type { Store } from "./types/Store"

const disposeGlobalStore = (): never => {
    throw new Error(
        "valdres: globalStore is process-wide and cannot be disposed",
    )
}

export const globalStore: Store = Object.assign(store("valdres-global-store"), {
    dispose: disposeGlobalStore,
})
