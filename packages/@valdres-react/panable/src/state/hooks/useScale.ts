import { useValue } from "valdres-react"
import { scaleAtom } from "../atoms/scaleAtom"
import type { ScopeId } from "../../types/ScopeId"

export const useScale = (scopeId: ScopeId) => useValue(scaleAtom(scopeId))
