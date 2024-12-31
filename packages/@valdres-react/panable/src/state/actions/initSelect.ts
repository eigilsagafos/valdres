import type { TransactionInterface } from "valdres"
import type { EventId } from "../../types/EventId"
import type { ScopeId } from "../../types/ScopeId"
import { actionAtom } from "../atoms/actionAtom"
import { activeActionsAtom } from "../atoms/activeActionsAtom"
import { cursorPositionRelativeSelector } from "../selectors/cursorPositionRelativeSelector"
import { configAtom } from "../atoms/configAtom"

export const initSelect = (
    txn: TransactionInterface,
    scopeId: ScopeId,
    eventId: EventId,
    e: MouseEvent | TouchEvent,
) => {
    txn.set(activeActionsAtom(scopeId), curr => [...curr, [eventId, "select"]])
    txn.set(actionAtom({ eventId, scopeId }), {
        kind: "select",
        eventId,
        scopeId,
        initialEvent: e,
        startPosition: txn.get(cursorPositionRelativeSelector({ scopeId })),
        selectedRefsFromPreviousUpdate: [],
    })
    const { onSelectInit } = txn.get(configAtom(scopeId))
    if (onSelectInit) onSelectInit(txn, eventId, scopeId)
}
