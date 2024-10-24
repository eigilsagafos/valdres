import { useValue } from "valdres-react"
import { cameraPositionAtom } from "../atoms/cameraPositionAtom"
import type { ScopeId } from "../../types/ScopeId"

export const useCameraPosition = (scopeId: ScopeId) =>
    useValue(cameraPositionAtom(scopeId))
