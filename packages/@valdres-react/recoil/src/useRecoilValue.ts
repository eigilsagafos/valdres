import { nodeOf, type RecoilValue } from "./lib/recoilValue"
import { useNodeValue } from "./lib/useNodeValue"
import { useRecoilStore } from "./lib/useRecoilStore"

/** Reads an atom or selector and re-renders when it changes. */
export const useRecoilValue = <T>(recoilValue: RecoilValue<T>): T => {
    const store = useRecoilStore()
    return useNodeValue(store, nodeOf(recoilValue, "useRecoilValue").state)
}
