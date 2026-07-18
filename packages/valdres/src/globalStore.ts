import { store } from "./store"

const disposeGlobalStore = (): never => {
    throw new Error("globalStore is process-wide and cannot be disposed")
}

export const globalStore = Object.assign(store("valdres-global-store"), {
    atoms: new Map(),
    atomFamilies: new Map(),
    dispose: disposeGlobalStore,
})
