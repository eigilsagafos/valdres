import { useValue } from "valdres-react"
import { scaleAtom } from "../atoms/scaleAtom"

export const useScale = () => useValue(scaleAtom)
