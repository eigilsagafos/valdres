import type { Store } from "valdres"
import { getValdresContext } from "./context"

export const useStore = (store?: Store): Store => {
    return store || getValdresContext()
}
