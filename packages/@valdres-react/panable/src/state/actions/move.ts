import type { Store } from "valdres"
import type { EventId } from "../../types/EventId"
import { actionAtom } from "../atoms/actionAtom"
import { cameraPositionAtom } from "../atoms/cameraPositionAtom"
import { scaleAtom } from "../atoms/scaleAtom"
import { updateDragActionsAfterMove } from "./updateDragActionsAfterMove"

export const move = (
    eventId: EventId,
    x: number,
    y: number,
    store: Store,
) => {
    const action = store.get(actionAtom(eventId))
    const { initialCameraPosition, initialMousePosition } = action
    const scale = store.get(scaleAtom)
    const cameraPos = store.get(cameraPositionAtom)
    const newX = initialCameraPosition.x - (initialMousePosition.x - x) / scale
    const newY = initialCameraPosition.y - (initialMousePosition.y - y) / scale

    const xDiff = Math.abs(action.initialMousePosition.x - x)
    const yDiff = Math.abs(action.initialMousePosition.y - y)
    if (!(xDiff > 3 || yDiff > 3)) {
        return
    } else {
        store.set(cameraPositionAtom, {
            x: newX,
            y: newY,
            animate: false,
        })

        store.set(actionAtom(eventId), curr => ({
            ...curr,
            initialized: true,
        }))

        const deltaX = cameraPos.x - newX
        const deltaY = cameraPos.y - newY
        updateDragActionsAfterMove(store, deltaX, deltaY)
    }
}
