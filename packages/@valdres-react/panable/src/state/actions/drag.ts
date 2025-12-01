import { draggableItemAtom } from "@valdres-react/draggable"
import { atom, type Store, type Transaction } from "valdres"
import type { Size } from "../../../../draggable/types/Size"
import type { DragAction } from "../../types/DragAction"
import { calculateRelativeCursorPos } from "../../utils/getCursorPositionRelative"
import { actionAtom } from "../atoms/actionAtom"
import { cameraPositionAtom } from "../atoms/cameraPositionAtom"
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
    eventId: string | number,
    clientX: number,
    clientY: number,
    event: MouseEvent | TouchEvent,
    store: Store,
) => {
    let action = store.get(actionAtom(eventId)) as DragAction
    const itemPos = action.itemPos()
    const itemSize = action.itemSize()
    const scale = store.get(scaleAtom)
    const scalePrevious = store.get(scalePreviousAtom)
    const camPos = store.get(cameraPositionAtom)
    const camPosInit = store.get(camPosInitAtom)
    const mouseOffsetInit = store.get(mouseOffsetInitAtom)
    const mousePosInit = store.get(mousePosInitAtom)
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
            store.set(actionAtom(eventId), curr => ({
                ...curr!,
                initialized: true,
            }))

            if (action.onDragStart) {
                action.onDragStart(event, eventId, txn)
                // We update the action in case the onDragStart modified it
                action = store.get(actionAtom(eventId)) as DragAction
            }

            store.set(mousePosInitAtom, {
                x: action.initialMousePosition.x,
                y: action.initialMousePosition.y,
            })
            store.set(mouseOffsetInitAtom, {
                x: action.mouseOffset.x,
                y: action.mouseOffset.y,
            })
            store.set(camPosInitAtom, {
                x: camPos.x,
                y: camPos.y,
            })
            store.set(scalePreviousAtom, scale)
            dropzones = store.get(action.dropzonesSelector)
            return
        }
    }
    if (dropzones.length === 0) {
        dropzones = store.get(action.dropzonesSelector)
    }

    const dropZones = Object.entries(dropzones).map(([k, v]) => ({
        id: k,
        ...v,
    }))

    // When zooming we need to recalculate: mousePosInit, mouseOffset and camPosInit.
    if (scalePrevious !== scale) {
        const scalar = scale / scalePrevious

        // Update initialMousePosition
        store.set(mousePosInitAtom, {
            x: mousePos.x + (mousePosInit.x - mousePos.x) * scalar,
            y: mousePos.y + (mousePosInit.y - mousePos.y) * scalar,
        })

        // Update mouseOffset
        store.set(mouseOffsetInitAtom, {
            x: mouseOffsetInit.x * scalar,
            y: mouseOffsetInit.y * scalar,
        })

        // Calculate the camera shift caused by zoom
        const outerCanvas = store.get(outerCanvasSizeAtom)
        const innerCanvas = store.get(innerCanvasSizeAtom)
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
        store.set(camPosInitAtom, {
            x: camPosInit.x - xDiff,
            y: camPosInit.y - yDiff,
        })

        // Set previousScale to scale
        store.set(scalePreviousAtom, scale)

        return
    }

    // cameraPositionDist starts out as 0, but if you pan while dragging we calculate the dist.
    const cameraPositionDist = {
        x: camPosInit.x - camPos.x,
        y: camPosInit.y - camPos.y,
    }

    // localDist is the distance between current mouse position and initial mouse position.
    // It starts out as 0, and increases as you move away from the initial position.
    const mouseDist = {
        x: (mousePos.x - mousePosInit.x) / scale,
        y: (mousePos.y - mousePosInit.y) / scale,
    }

    // This is the local coordinate WITHIN the draggableItem.
    // mouseOffset is {x: 0, y: 0} when dragging at the top left corner of the item.
    const mouseOffset = {
        x: mouseOffsetInit.x / scale,
        y: mouseOffsetInit.y / scale,
    }

    // localX and localY is the position in the local (process) coordinate space.
    const local = {
        x: itemPos.x + mouseDist.x + cameraPositionDist.x + mouseOffset.x,
        y: itemPos.y + mouseDist.y + cameraPositionDist.y + mouseOffset.y,
    }

    const activeDropzone = checkForActiveDropzone(
        dropZones,
        local.x,
        local.y,
        itemSize,
    )

    if (activeDropzone) {
        store.set(actionAtom(eventId), curr => ({
            ...curr!,
            activeDropzone,
        }))

        const dropzoneCenterX = (itemSize.w - activeDropzone.w) / 2
        const dropzoneCenterY = (itemSize.h - activeDropzone.h) / 2

        store.set(draggableItemAtom(action.id), state => ({
            ...state,
            isDragging: true,
            isSnapping: true,
            x: activeDropzone.x - itemPos.x - dropzoneCenterX,
            y: activeDropzone.y - itemPos.y - dropzoneCenterY,
        }))
    } else if (action.initialized) {
        // itemCenter moves the draggableItems center underneath the cursor.
        const itemCenter = {
            x: mouseOffset.x - itemSize.w / 2,
            y: mouseOffset.y - itemSize.h / 2,
        }
        console.log("itemCenter")
        store.set(draggableItemAtom(action.id), state => ({
            ...state,
            isDragging: true,
            isSnapping: false,
            x: mouseDist.x + cameraPositionDist.x + itemCenter.x,
            y: mouseDist.y + cameraPositionDist.y + itemCenter.y,
        }))

        if (action.activeDropzone) {
            store.set(actionAtom(eventId), curr => ({
                ...curr!,
                activeDropzone: null,
            }))
        }
    }
}
