import { atomFamily } from "valdres"
import type { EventId } from "../../types/EventId"
import type { ScopeId } from "../../types/ScopeId"
import type { Action } from "../../types/Action"

export const actionAtom = atomFamily<
    Action | null,
    [{ eventId: EventId; scopeId: ScopeId }]
>(null, { name: "@valdres-react/panable/actionAtom" })
