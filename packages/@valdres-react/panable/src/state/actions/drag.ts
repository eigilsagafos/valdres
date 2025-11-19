import { draggableItemAtom } from "@valdres-react/draggable"
import { atom, type Transaction } from "valdres"
import type { Size } from "../../../../draggable/types/Size"
import type { DragAction } from "../../types/DragAction"
import { actionAtom } from "../atoms/actionAtom"
import { scaleAtom } from "../atoms/scaleAtom"
import type { DropZone } from "./../../types/DropZone"
import { cameraPositionAtom } from "../atoms/cameraPositionAtom"
import { getCursorPositionRelative } from "../../utils/getCursorPositionRelative"
import { isFunction } from "../../../../../valdres/src/lib/isFunction"

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
const mousePosInitAtom = atom({ x: 0, y: 0 })
const camPosInitAtom = atom({ x: 0, y: 0 })
const updatedMouseOffsetAtom = atom({ x: 0, y: 0 })
const scalePreviousAtom = atom(1)

export const drag = (
    txn: Transaction,
    eventId: string | number,
    clientX: number,
    clientY: number,
    event: MouseEvent | TouchEvent,
) => {
    let action = txn.get(actionAtom(eventId)) as DragAction
    const scale = txn.get(scaleAtom)
    const camPos = txn.get(cameraPositionAtom)
    const mousePosX = clientX + window.scrollX
    const mousePosY = clientY + window.scrollY

    if (action?.invalid || action === null) return null

    if (action.initialized === false) {
        const deltaX = Math.abs(mousePosX - action.initialMousePosition.x)
        const deltaY = Math.abs(mousePosY - action.initialMousePosition.y)

        if (!(deltaX > 2 || deltaY > 2)) {
            return
        } else {
            // Deselect items if dragging one that is not selected
            txn.set(actionAtom(eventId), curr => ({
                ...curr!,
                initialized: true,
            }))

            if (action.onDragStart) {
                action.onDragStart(event, eventId, txn)
                // We update the action in case the onDragStart modified it
                action = txn.get(actionAtom(eventId)) as DragAction
            }
            txn.set(mousePosInitAtom, {
                x: action.initialMousePosition.x,
                y: action.initialMousePosition.y,
            })
            txn.set(updatedMouseOffsetAtom, {
                x: action.mouseOffset.x,
                y: action.mouseOffset.y,
            })
            txn.set(camPosInitAtom, {
                x: camPos.x,
                y: camPos.y,
            })
            txn.set(scalePreviousAtom, scale)

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

    const { originPosition, originSize } = action
    const updatedInitialMousePos = txn.get(mousePosInitAtom)
    const camPosInit = txn.get(camPosInitAtom)
    const updatedMouseOffset = txn.get(updatedMouseOffsetAtom)

    const scalePrevious = txn.get(scalePreviousAtom)

    const originPositionRes = isFunction(originPosition)
        ? originPosition()
        : originPosition
    const originSizeRes = isFunction(originSize) ? originSize() : originSize

    const mouseOffsetX = updatedMouseOffset.x / scale
    const mouseOffsetY = updatedMouseOffset.y / scale

    // These values starts out as 0, but if you pan while dragging we calculate the delta.
    const cameraPositionDeltaX = camPosInit.x - camPos.x
    const cameraPositionDeltaY = camPosInit.y - camPos.y

    // When zooming we need to recalculate:
    // - initialMousePosition
    // - initialCameraPosition
    // - mouseOffset
    if (scalePrevious !== scale) {
        const scalar = scale / scalePrevious

        // Update initialMousePosition
        const originalMouseVectorX = updatedInitialMousePos.x - mousePosX
        const originalMouseVectorY = updatedInitialMousePos.y - mousePosY
        const scaledMouseVectorX = originalMouseVectorX * scalar
        const scaledMouseVectorY = originalMouseVectorY * scalar
        const deltaMouseX = mousePosX + scaledMouseVectorX
        const deltaMouseY = mousePosY + scaledMouseVectorY
        txn.set(mousePosInitAtom, { x: deltaMouseX, y: deltaMouseY })

        // Calculate the camera shift caused by zoom
        // The zoom function shifts camera to keep cursor at same logical position
        // We need to calculate that shift and apply it to updatedInitialCameraPos
        const mouseBefore = getCursorPositionRelative(txn.get)
        // Temporarily revert scale to calculate what mouse position was before zoom
        txn.set(scaleAtom, scalePrevious)
        const mouseBeforeZoom = getCursorPositionRelative(txn.get)
        txn.set(scaleAtom, scale)
        const xDiff = mouseBeforeZoom.x - mouseBefore.x
        const yDiff = mouseBeforeZoom.y - mouseBefore.y

        // Update initialCameraPosition
        // Shift it by the same amount zoom shifted the camera
        txn.set(camPosInitAtom, {
            x: camPosInit.x - xDiff,
            y: camPosInit.y - yDiff,
        })

        // Update mouseOffset
        txn.set(updatedMouseOffsetAtom, {
            x: updatedMouseOffset.x * scalar,
            y: updatedMouseOffset.y * scalar,
        })

        // Reset previousScale
        txn.set(scalePreviousAtom, scale)

        // We return early to use fresh values when drag-function is called again.
        return
    }

    // localDeltaX is the distance between current mouse position and initial mouse position.
    // It starts out as 0, and increases as you move away from the initial position.
    const localDeltaX = (mousePosX - updatedInitialMousePos.x) / scale
    const localDeltaY = (mousePosY - updatedInitialMousePos.y) / scale

    // OffsetX and offsetY is the distance between center of the draggableItem and the mouse.
    // In other words, if you click in the center of a draggableItem, offsetX and offsetY should be 0.
    const offsetX = mouseOffsetX - originSizeRes.w / 2
    const offsetY = mouseOffsetY - originSizeRes.h / 2

    // localX and localY is the position in the local (process) coordinate space.
    const localX =
        originPositionRes.x + localDeltaX + mouseOffsetX + cameraPositionDeltaX
    const localY =
        originPositionRes.y + localDeltaY + mouseOffsetY + cameraPositionDeltaY

    const currentActiveDropzone = checkForActiveDropzone(
        dropZones,
        localX,
        localY,
        originSizeRes,
    )

    if (currentActiveDropzone) {
        txn.set(actionAtom(eventId), curr => ({
            ...curr!,
            activeDropzone: currentActiveDropzone,
        }))

        const wDiff = originSizeRes.w - currentActiveDropzone.w
        const hDiff = originSizeRes.h - currentActiveDropzone.h

        txn.set(draggableItemAtom(action.id), state => ({
            ...state,
            isDragging: true,
            isSnapping: true,
            x: currentActiveDropzone.x - originPositionRes.x - wDiff / 2,
            y: currentActiveDropzone.y - originPositionRes.y - hDiff / 2,
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
                ...curr!,
                activeDropzone: null,
            }))
        }
    }
}
