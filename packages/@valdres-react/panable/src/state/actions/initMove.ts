import type { TransactionInterface } from "valdres"
import type { EventId } from "../../types/EventId"
import type { ScopeId } from "../../types/ScopeId"
import { actionAtom } from "../atoms/actionAtom"
import { activeActionsAtom } from "../atoms/activeActionsAtom"
import { cameraPositionAtom } from "../atoms/cameraPositionAtom"

export const initMove = (
    txn: TransactionInterface,
    scopeId: ScopeId,
    eventId: EventId,
    x: number,
    y: number,
    timeStamp: number,
) => {
    txn.set(activeActionsAtom(scopeId), curr => [...curr, [eventId, "move"]])
    txn.set(actionAtom({ eventId, scopeId }), {
        kind: "move",
        initialized: false,
        eventId,
        scopeId,
        timeStamp,
        initialCameraPosition: txn.get(cameraPositionAtom(scopeId)),
        initialMousePosition: {
            x,
            y,
        },
    })
}
