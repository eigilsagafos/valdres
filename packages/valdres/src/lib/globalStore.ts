import { store } from "../store"
import { version } from "../../package.json"

// @ts-ignore
if (globalThis.__valdres__) {
    throw new Error(`Error! An instance of valdres is already loaded`)
} else {
    // @ts-ignore
    globalThis.__valdres__ = version
}

export const globalStore = store("global")
