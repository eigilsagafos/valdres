import type { TransactionInterface } from "valdres-react"
import { actionAtom } from "../atoms/actionAtom"
import { activeActionsAtom } from "../atoms/activeActionsAtom"
import { scaleAtom } from "../atoms/scaleAtom"
import type { ScopeId } from "../../types/ScopeId"
import type { EventId } from "../../types/EventId"

export const upgradeMoveToZoom = (
    txn: TransactionInterface,
    scopeId: ScopeId,
    moveEventId: EventId,
    t: Touch,
) => {
    const initialScale = txn.get(scaleAtom(scopeId))
    txn.set(actionAtom({ eventId: moveEventId, scopeId }), {
        kind: "zoom",
        eventId: moveEventId,
        scopeId,
        initialScale,
    })
    const eventId = t.identifier
    txn.set(activeActionsAtom(scopeId), curr => [...curr, [eventId, "zoom"]])
    txn.set(actionAtom({ eventId, scopeId }), {
        kind: "zoom",
        eventId,
        scopeId,
        initialScale,
    })
}
