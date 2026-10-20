import type { RecoilState } from "./lib/recoilValue"
import type { SetterOrUpdater } from "./types/SetterOrUpdater"
import { useRecoilValue } from "./useRecoilValue"
import { useSetRecoilState } from "./useSetRecoilState"

/** `[useRecoilValue(state), useSetRecoilState(state)]`. */
export const useRecoilState = <T>(
    recoilState: RecoilState<T>,
): [T, SetterOrUpdater<T>] => [
    useRecoilValue(recoilState),
    useSetRecoilState(recoilState),
]
