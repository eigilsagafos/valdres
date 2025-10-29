import type { Transaction } from "valdres"
import type { EventId } from "../../types/EventId"
import { actionAtom } from "../atoms/actionAtom"
import { activeActionsAtom } from "../atoms/activeActionsAtom"
import { scaleAtom } from "../atoms/scaleAtom"

export const upgradeMoveToZoom = (
    txn: Transaction,
    moveEventId: EventId,
    t: Touch,
) => {
    const initialScale = txn.get(scaleAtom)
    txn.set(actionAtom(moveEventId), {
        kind: "zoom",
        eventId: moveEventId,
        initialScale,
    })
    const eventId = t.identifier
    txn.set(activeActionsAtom, curr => [...curr, [eventId, "zoom"]])
    txn.set(actionAtom(eventId), {
        kind: "zoom",
        eventId,
        initialScale,
    })
}
