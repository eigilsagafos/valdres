import { atomFamily } from "valdres-react"
import type { EventId } from "../../types/EventId"
import type { ScopeId } from "../../types/ScopeId"
import type { Action } from "../../types/Action"

export const actionAtom = atomFamily<
    { eventId: EventId; scopeId: ScopeId },
    Action | null
>(null, { name: "@valdres-react/panable/actionAtom" })
