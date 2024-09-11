import { isAtom } from "../utils/isAtom"
import { isSelector } from "../utils/isSelector"

export const isRecoilValue = x => isAtom(x) || isSelector(x)
