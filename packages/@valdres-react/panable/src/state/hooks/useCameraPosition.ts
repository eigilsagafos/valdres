import { useValue } from "valdres-react"
import { cameraPositionAtom } from "../atoms/cameraPositionAtom"

export const useCameraPosition = () => useValue(cameraPositionAtom)
