import { useValue } from "valdres-react"
import { activeActionsByKindSelector } from "../selectors/activeActionsByKindSelector"
import type { ActionKind } from "../../types/ActionKind"
import type { ScopeId } from "../../types/ScopeId"

export const useActiveActonsByKind = (kind: ActionKind, scopeId: ScopeId) =>
    useValue(activeActionsByKindSelector({ scopeId, kind }))
