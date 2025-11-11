import { draggableItemAtom } from "@valdres-react/draggable"
import type { Transaction } from "valdres"
import type { Size } from "../../../../draggable/types/Size"
import type { DragAction } from "../../types/DragAction"
import { actionAtom } from "../atoms/actionAtom"
import { scaleAtom } from "../atoms/scaleAtom"
import type { DropZone } from "./../../types/DropZone"
import { cameraPositionAtom } from "../atoms/cameraPositionAtom"

const checkForActiveDropzone = (
    zones: Array<DropZone>,
    localX: number,
    localY: number,
    originSize: Size,
): DropZone | undefined => {
    return zones.find(zone => {
        if (zone) {
            const padding = 10
            const { w, h, x, y } = zone
            // If the draggableItem is quite wide we increase the dropzones width slightly.
            const remainingWidth = Math.max(originSize.w / 2 - w, 0)

            const left = x - padding - remainingWidth / 2
            const right = x + w + padding + remainingWidth / 2
            const top = y - padding
            const bottom = y + h + padding

            const withinLeftBorder = localX > left
            const withinRightBorder = localX < right
            const withinTopBorder = localY > top
            const withinBottomBorder = localY < bottom

            return (
                withinLeftBorder &&
                withinRightBorder &&
                withinTopBorder &&
                withinBottomBorder
            )
        }
    })
}

let dropzones: Array<DropZone> = []

export const drag = (
    txn: Transaction,
    eventId: string | number,
    clientX: number,
    clientY: number,
    event: MouseEvent | TouchEvent,
) => {
    let action = txn.get(actionAtom(eventId)) as DragAction
    if (action?.invalid || action === null) return null
    if (action.initialized === false) {
        const deltaX = Math.abs(
            clientX + window.scrollX - action.initialMousePosition.x,
        )
        const deltaY = Math.abs(
            clientY + window.scrollY - action.initialMousePosition.y,
        )
        if (!(deltaX > 2 || deltaY > 2)) {
            return
        } else {
            // Deselect items if dragging one that is not selected
            txn.set(actionAtom(eventId), curr => ({
                ...curr,
                initialized: true,
            }))

            if (action.onDragStart) {
                action.onDragStart(event, eventId, txn)
                // We update the action in case the onDragStart modified it
                action = txn.get(actionAtom(eventId)) as DragAction
            }

            dropzones = txn.get(action.dropzonesSelector)
        }
    }

    if (dropzones.length === 0) {
        dropzones = txn.get(action.dropzonesSelector)
    }

    const dropZones = Object.entries(dropzones).map(([k, v]) => ({
        id: k,
        ...v,
    }))

    const scale = txn.get(scaleAtom)
    const cameraPosition = txn.get(cameraPositionAtom)
    // Compensate all variables by scale/zoom level
    const mousePosX = (clientX + window.scrollX) / scale
    const mousePosY = (clientY + window.scrollY) / scale
    const initMousePosX = action.initialMousePosition.x / scale
    const initMousePosY = action.initialMousePosition.y / scale
    const mouseOffsetX = action.mouseOffset.x / scale
    const mouseOffsetY = action.mouseOffset.y / scale

    // These values starts out as 0, but if you pan while dragging we calculate the delta.
    const cameraPositionDeltaX =
        action.initialCameraPosition.x - cameraPosition.x
    const cameraPositionDeltaY =
        action.initialCameraPosition.y - cameraPosition.y

    const originPosition =
        typeof action?.originPosition === "function"
            ? action?.originPosition()
            : action?.originPosition
    const originSize =
        typeof action.originSize === "function"
            ? action.originSize()
            : action.originSize

    // localDeltaX is the distance between current mouse position and initial mouse position.
    // It starts out as 0, and increases as you move away from the initial position.
    const localDeltaX = Math.floor(mousePosX - initMousePosX)
    const localDeltaY = Math.floor(mousePosY - initMousePosY)

    // OffsetX and offsetY is the distance between center of the draggableItem and the mouse.
    // In other words, if you click in the center of a draggableItem, offsetX and offsetY should be 0.
    const offsetX = mouseOffsetX - originSize.w / 2
    const offsetY = mouseOffsetY - originSize.h / 2

    // localX and localY is the position in the local (process) coordinate space.
    const localX =
        originPosition.x + localDeltaX + mouseOffsetX + cameraPositionDeltaX
    const localY =
        originPosition.y + localDeltaY + mouseOffsetY + cameraPositionDeltaY

    const currentActiveDropzone = checkForActiveDropzone(
        dropZones,
        localX,
        localY,
        originSize,
    )

    if (currentActiveDropzone) {
        txn.set(actionAtom(eventId), curr => ({
            ...curr,
            activeDropzone: currentActiveDropzone,
        }))

        const wDiff = originSize.w - currentActiveDropzone.w
        const hDiff = originSize.h - currentActiveDropzone.h

        txn.set(draggableItemAtom(action.id), state => ({
            ...state,
            isDragging: true,
            isSnapping: true,
            x: currentActiveDropzone.x - originPosition.x - wDiff / 2,
            y: currentActiveDropzone.y - originPosition.y - hDiff / 2,
        }))
    } else if (action.initialized) {
        txn.set(draggableItemAtom(action.id), state => ({
            ...state,
            isDragging: true,
            isSnapping: false,
            x: localDeltaX + offsetX + cameraPositionDeltaX,
            y: localDeltaY + offsetY + cameraPositionDeltaY,
        }))

        if (action.activeDropzone) {
            txn.set(actionAtom(eventId), curr => ({
                ...curr,
                activeDropzone: null,
            }))
        }
    }
}
