import { store } from "./store"

export const globalStore = Object.assign(store("valdres-global-store"), {
    atoms: new Map(),
    atomFamilies: new Map(),
})
