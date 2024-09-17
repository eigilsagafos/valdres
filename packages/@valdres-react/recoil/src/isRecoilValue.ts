import { isAtom, isSelector } from "valdres-react"

export const isRecoilValue = (x: any) => isAtom(x) || isSelector(x)
