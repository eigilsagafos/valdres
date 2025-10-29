import type { Transaction } from "valdres"
import type { EventId } from "../../types/EventId"
import { actionAtom } from "../atoms/actionAtom"
import { activeActionsAtom } from "../atoms/activeActionsAtom"
import { cameraPositionAtom } from "../atoms/cameraPositionAtom"

export const initMove = (
    txn: Transaction,
    eventId: EventId,
    x: number,
    y: number,
    timeStamp: number,
) => {
    txn.set(activeActionsAtom, curr => [...curr, [eventId, "move"]])
    txn.set(actionAtom(eventId), {
        kind: "move",
        initialized: false,
        eventId,
        timeStamp,
        initialCameraPosition: txn.get(cameraPositionAtom),
        initialMousePosition: {
            x,
            y,
        },
    })
}
