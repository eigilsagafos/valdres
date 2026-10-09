import { isRecoilValueObject, type RecoilValue } from "./lib/recoilValue"

/** True for atoms and selectors created by this package. */
export const isRecoilValue = (value: unknown): value is RecoilValue<any> =>
    isRecoilValueObject(value)
