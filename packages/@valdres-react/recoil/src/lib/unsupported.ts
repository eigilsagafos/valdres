import { UnsupportedRecoilFeatureError } from "../UnsupportedRecoilFeatureError"

export const unsupported = (feature: string, detail: string): never => {
    throw new UnsupportedRecoilFeatureError(feature, detail)
}

export const ASYNC_DETAIL =
    "Valdres 1.0 state is synchronous, so there is no pending state to suspend on: await the work outside Recoil state and set the result."
