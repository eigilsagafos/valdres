import { atomFamily } from "valdres"
import type { Action } from "../../types/Action"
import type { EventId } from "../../types/EventId"

export const actionAtom = atomFamily<Action | null, [EventId]>(null, {
    name: "@valdres-react/panable/actionAtom",
})
