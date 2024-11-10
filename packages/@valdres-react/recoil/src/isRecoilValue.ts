import { isAtom, isSelector } from "valdres"

export const isRecoilValue = (x: any) => isAtom(x) || isSelector(x)
