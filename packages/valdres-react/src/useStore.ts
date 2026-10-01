import type { Store } from "valdres"
import { useSelectedStore } from "./lib/useSelectedStore"

export const useStore = (store?: Store): Store => useSelectedStore(store)
