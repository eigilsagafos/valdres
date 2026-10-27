import type { State } from "valdres"
import { nodeOf, type RecoilValue } from "./lib/recoilValue"
import { useNodeValue } from "./lib/useNodeValue"
import { useRecoilStore } from "./lib/useRecoilStore"

/**
 * Reads an atom or selector and re-renders when it changes. Also reads any
 * Valdres State (a Valdres extension).
 */
export const useRecoilValue = <T>(recoilValue: RecoilValue<T> | State<T>): T => {
    const store = useRecoilStore()
    return useNodeValue(store, nodeOf(recoilValue, "useRecoilValue").state)
}
