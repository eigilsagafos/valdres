import type { Transaction } from "valdres"
import type { EventId } from "../../types/EventId"
import { actionAtom } from "../atoms/actionAtom"
import { activeActionsAtom } from "../atoms/activeActionsAtom"
import { configAtom } from "../atoms/configAtom"
import { cursorPositionRelativeSelector } from "../selectors/cursorPositionRelativeSelector"

export const initSelect = (
    txn: Transaction,
    eventId: EventId,
    e: MouseEvent | TouchEvent,
) => {
    txn.set(activeActionsAtom, curr => [...curr, [eventId, "select"]])
    txn.set(actionAtom(eventId), {
        kind: "select",
        eventId,
        initialEvent: e,
        startPosition: txn.get(cursorPositionRelativeSelector()),
        selectedRefsFromPreviousUpdate: [],
    })
    const { onSelectInit } = txn.get(configAtom)
    if (onSelectInit) onSelectInit(txn, eventId)
}
