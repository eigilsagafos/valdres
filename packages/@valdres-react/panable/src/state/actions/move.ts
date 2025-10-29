import type { Transaction } from "valdres"
import type { EventId } from "../../types/EventId"
import { actionAtom } from "../atoms/actionAtom"
import { cameraPositionAtom } from "../atoms/cameraPositionAtom"
import { scaleAtom } from "../atoms/scaleAtom"
import { updateDragActionsAfterMove } from "./updateDragActionsAfterMove"

export const move = (
    txn: Transaction,
    eventId: EventId,
    x: number,
    y: number,
) => {
    const action = txn.get(actionAtom(eventId))
    const { initialCameraPosition, initialMousePosition } = action
    const scale = txn.get(scaleAtom)
    const cameraPos = txn.get(cameraPositionAtom)
    const newX = initialCameraPosition.x - (initialMousePosition.x - x) / scale
    const newY = initialCameraPosition.y - (initialMousePosition.y - y) / scale

    const xDiff = Math.abs(action.initialMousePosition.x - x)
    const yDiff = Math.abs(action.initialMousePosition.y - y)
    if (!(xDiff > 3 || yDiff > 3)) {
        return
    } else {
        txn.set(cameraPositionAtom, {
            x: newX,
            y: newY,
            animate: false,
        })

        txn.set(actionAtom(eventId), curr => ({
            ...curr,
            initialized: true,
        }))

        const deltaX = cameraPos.x - newX
        const deltaY = cameraPos.y - newY
        updateDragActionsAfterMove(txn, deltaX, deltaY)
    }
}
