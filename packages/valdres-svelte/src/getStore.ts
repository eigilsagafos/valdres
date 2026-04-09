import type { Store } from "valdres"
import { getValdresContext } from "./context"

export const getStore = (store?: Store): Store => {
    return store || getValdresContext()
}
