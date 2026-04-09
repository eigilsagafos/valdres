import { isAtom, isSelector } from "valdres"

export const isRecoilValue = (x: any) => {
    if (x == null || (typeof x !== "object" && typeof x !== "function")) {
        return false
    }
    return isAtom(x) || isSelector(x)
}
