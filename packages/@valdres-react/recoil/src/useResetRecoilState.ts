import { useCallback } from "react"
import { resetAction } from "./lib/actions"
import { queueOrPerform } from "./lib/batch"
import { nodeOf, type RecoilState } from "./lib/recoilValue"
import { useRecoilStore } from "./lib/useRecoilStore"
import type { Resetter } from "./types/Resetter"

/** A stable function that resets an atom, or passes `DefaultValue` to a selector's `set`. */
export const useResetRecoilState = (recoilState: RecoilState<any>): Resetter => {
    nodeOf(recoilState, "useResetRecoilState")
    const store = useRecoilStore()
    return useCallback(
        () => queueOrPerform(store, resetAction(recoilState)),
        [store, recoilState],
    )
}
