import { selectorFamily } from "valdres"
import { activeActionsAtom } from "../atoms/activeActionsAtom"
import { actionAtom } from "../atoms/actionAtom"
import type { ActionKind } from "../../types/ActionKind"
import type { ScopeId } from "../../types/ScopeId"
import type { Action } from "../../types/Action"

export const activeActionsByKindSelector = selectorFamily<
    { scopeId: ScopeId; kind: ActionKind },
    Action[]
>(
    ({ scopeId, kind }) =>
        get => {
            return get(activeActionsAtom(scopeId))
                .filter(([, k]) => k === kind)
                .map(([eventId]) => get(actionAtom({ eventId, scopeId })))
        },
    {
        name: "@valdres-react/panable/activeActionsByKindSelector",
    },
)
