import { useValue } from "valdres-react"
import { configAtom } from "../atoms/configAtom"
import type { ScopeId } from "../../types/ScopeId"

export const useConfig = (scopeId: ScopeId) => useValue(configAtom(scopeId))
