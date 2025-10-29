import { selectorFamily } from "valdres"
import type { Action } from "../../types/Action"
import type { ActionKind } from "../../types/ActionKind"
import { actionAtom } from "../atoms/actionAtom"
import { activeActionsAtom } from "../atoms/activeActionsAtom"

export const activeActionsByKindSelector = selectorFamily<Action[]>(
    (kind: ActionKind) => get => {
        return get(activeActionsAtom)
            .filter(([, k]) => k === kind)
            .map(([eventId]) => get(actionAtom(eventId)))
    },
    { name: "@valdres-react/panable/activeActionsByKindSelector" },
)
