import { draggableItemAtom } from "@valdres-react/draggable"
import { atom, type Transaction } from "valdres"
import type { Size } from "../../../../draggable/types/Size"
import type { DragAction } from "../../types/DragAction"
import { calculateRelativeCursorPos } from "../../utils/getCursorPositionRelative"
import { actionAtom } from "../atoms/actionAtom"
import { cameraPositionAtom } from "../atoms/cameraPositionAtom"
import { cursorPositionAtom } from "../atoms/cursorPositionAtom"
import { innerCanvasSizeAtom } from "../atoms/innerCanvasSizeAtom"
import { outerCanvasSizeAtom } from "../atoms/outerCanvasSizeAtom"
import { scaleAtom } from "../atoms/scaleAtom"
import type { DropZone } from "./../../types/DropZone"

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
const scalePreviousAtom = atom(1)
const camPosInitAtom = atom({ x: 0, y: 0 })
const mousePosInitAtom = atom({ x: 0, y: 0 })
const mouseOffsetInitAtom = atom({ x: 0, y: 0 })

export const drag = (
    txn: Transaction,
    eventId: string | number,
    clientX: number,
    clientY: number,
    event: MouseEvent | TouchEvent,
) => {
    let action = txn.get(actionAtom(eventId)) as DragAction
    const { itemPos, itemSize } = action
    const scale = txn.get(scaleAtom)
    const scalePrevious = txn.get(scalePreviousAtom)
    const camPos = txn.get(cameraPositionAtom)
    const camPosInit = txn.get(camPosInitAtom)
    const mouseOffsetInit = txn.get(mouseOffsetInitAtom)
    const mousePosInit = txn.get(mousePosInitAtom)
    const mousePos = {
        x: clientX + window.scrollX,
        y: clientY + window.scrollY,
    }

    if (action?.invalid || action === null) return null

    if (action.initialized === false) {
        const deltaX = Math.abs(mousePos.x - action.initialMousePosition.x)
        const deltaY = Math.abs(mousePos.y - action.initialMousePosition.y)

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
            txn.set(mouseOffsetInitAtom, {
                x: action.mouseOffset.x,
                y: action.mouseOffset.y,
            })
            txn.set(camPosInitAtom, {
                x: camPos.x,
                y: camPos.y,
            })
            txn.set(scalePreviousAtom, scale)
            dropzones = txn.get(action.dropzonesSelector)
            return
        }
    }
    if (dropzones.length === 0) {
        dropzones = txn.get(action.dropzonesSelector)
    }

    const dropZones = Object.entries(dropzones).map(([k, v]) => ({
        id: k,
        ...v,
    }))

    // When zooming we need to recalculate: mousePosInit, mouseOffset and camPosInit.
    if (scalePrevious !== scale) {
        const scalar = scale / scalePrevious

        // Update initialMousePosition
        txn.set(mousePosInitAtom, {
            x: mousePos.x + (mousePosInit.x - mousePos.x) * scalar,
            y: mousePos.y + (mousePosInit.y - mousePos.y) * scalar,
        })

        // Update mouseOffset
        txn.set(mouseOffsetInitAtom, {
            x: mouseOffsetInit.x * scalar,
            y: mouseOffsetInit.y * scalar,
        })

        // Calculate the camera shift caused by zoom
        const outerCanvas = txn.get(outerCanvasSizeAtom)
        const innerCanvas = txn.get(innerCanvasSizeAtom)
        const mouseBeforeZoom = calculateRelativeCursorPos({
            camera: camPos,
            cursor: mousePos,
            scale: scalePrevious,
            outerCanvas,
            innerCanvas,
        })
        const mouseAfterZoom = calculateRelativeCursorPos({
            camera: camPos,
            cursor: mousePos,
            scale,
            outerCanvas,
            innerCanvas,
        })

        const xDiff = mouseBeforeZoom.x - mouseAfterZoom.x
        const yDiff = mouseBeforeZoom.y - mouseAfterZoom.y
        txn.set(camPosInitAtom, {
            x: camPosInit.x - xDiff,
            y: camPosInit.y - yDiff,
        })

        // Set previousScale to scale
        txn.set(scalePreviousAtom, scale)

        return
    }

    // These values starts out as 0, but if you pan while dragging we calculate the delta.
    const cameraPositionDist = {
        x: camPosInit.x - camPos.x,
        y: camPosInit.y - camPos.y,
    }

    // localDeltaX is the distance between current mouse position and initial mouse position.
    // It starts out as 0, and increases as you move away from the initial position.
    const localDist = {
        x: (mousePos.x - mousePosInit.x) / scale,
        y: (mousePos.y - mousePosInit.y) / scale,
    }

    const mouseOffset = {
        x: mouseOffsetInit.x / scale,
        y: mouseOffsetInit.y / scale,
    }

    // localX and localY is the position in the local (process) coordinate space.
    const local = {
        x: itemPos.x + localDist.x + mouseOffset.x + cameraPositionDist.x,
        y: itemPos.y + localDist.y + mouseOffset.y + cameraPositionDist.y,
    }

    const activeDropzone = checkForActiveDropzone(
        dropZones,
        local.x,
        local.y,
        itemSize,
    )

    if (activeDropzone) {
        txn.set(actionAtom(eventId), curr => ({
            ...curr!,
            activeDropzone,
        }))

        const dropzoneCenterX = (itemSize.w - activeDropzone.w) / 2
        const dropzoneCenterY = (itemSize.h - activeDropzone.h) / 2

        txn.set(draggableItemAtom(action.id), state => ({
            ...state,
            isDragging: true,
            isSnapping: true,
            x: activeDropzone.x - itemPos.x - dropzoneCenterX,
            y: activeDropzone.y - itemPos.y - dropzoneCenterY,
        }))
    } else if (action.initialized) {
        // offset.x and offset.y is the distance between center of the draggableItem and the mouse.
        // In other words, if you click in the center of a draggableItem, offset.x and offset.y should be 0.
        const offset = {
            x: mouseOffset.x - itemSize.w / 2,
            y: mouseOffset.y - itemSize.h / 2,
        }
        txn.set(draggableItemAtom(action.id), state => ({
            ...state,
            isDragging: true,
            isSnapping: false,
            x: localDist.x + cameraPositionDist.x + offset.x,
            y: localDist.y + cameraPositionDist.y + offset.y,
        }))

        if (action.activeDropzone) {
            txn.set(actionAtom(eventId), curr => ({
                ...curr!,
                activeDropzone: null,
            }))
        }
    }
}
