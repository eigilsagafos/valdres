import type { Store } from "valdres"
import { useSelectedStore } from "./lib/useSelectedStore"

export const useStore = (): Store => useSelectedStore()
