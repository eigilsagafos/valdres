import { atomFamily } from "valdres-react"
import type { ActionKind } from "../../types/ActionKind"
import type { ScopeId } from "../../types/ScopeId"
import type { EventId } from "../../types/EventId"

export const activeActionsAtom = atomFamily<ScopeId, [EventId, ActionKind][]>(
    [],
    { label: "@valdres-react/panable/activeActionsAtom" },
)
