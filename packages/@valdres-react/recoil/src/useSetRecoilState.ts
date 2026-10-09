import { useCallback } from "react"
import { setAction } from "./lib/actions"
import { queueOrPerform } from "./lib/batch"
import { nodeOf, type RecoilState } from "./lib/recoilValue"
import { useRecoilStore } from "./lib/useRecoilStore"
import type { SetterOrUpdater } from "./types/SetterOrUpdater"

/**
 * A stable setter that does not subscribe. Functions are updaters; a
 * `DefaultValue` resets. Inside a useRecoilCallback the write joins its batch.
 */
export const useSetRecoilState = <T>(
    recoilState: RecoilState<T>,
): SetterOrUpdater<T> => {
    nodeOf(recoilState, "useSetRecoilState")
    const store = useRecoilStore()
    return useCallback(
        valueOrUpdater => queueOrPerform(store, setAction(recoilState, valueOrUpdater)),
        [store, recoilState],
    )
}
