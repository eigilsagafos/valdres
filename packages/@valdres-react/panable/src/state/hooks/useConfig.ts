import { useValue } from "valdres-react"
import { configAtom } from "../atoms/configAtom"

export const useConfig = () => useValue(configAtom)
