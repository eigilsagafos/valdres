import { draggableItemAtom } from "@valdres-react/draggable"
import type { Transaction } from "valdres"
import type { ScopeId } from "../../types/ScopeId"
import { actionAtom } from "../atoms/actionAtom"
import { scaleAtom } from "../atoms/scaleAtom"
import type { DragAction } from "../../types/DragAction"

const checkForActiveDropzone = (
    zones: Array<DropZone>,
    localX: number,
    localY: number,
): DropZone => {
    return zones.find(zone => {
        if (zone) {
            const { w, h, x, y } = zone
            const left = x
            const right = x + w
            const top = y
            const bottom = y + h
            const withinLeftBorder = localX > left
            const withinRightBorder = localX < right
            const withinTopBorder = localY > top
            const withinBottomBorder = localY < bottom

            if (
                withinLeftBorder &&
                withinRightBorder &&
                withinTopBorder &&
                withinBottomBorder
            ) {
                console.log(
                    "AAA:localX, localY",
                    Math.round(localX),
                    Math.round(localY),
                )
                console.log("AAA:left", left)
                console.log("AAA:right", right)
                console.log("AAA:top", top)
                console.log("AAA:bottom", bottom)
                console.log("AAA:-----------------")
                return true
            }
        }
    })
}

let dropzones: Array<DropZone> = []

export const drag = (
    txn: Transaction,
    scopeId: ScopeId,
    eventId: string | number,
    clientX: number,
    clientY: number,
    event: MouseEvent | TouchEvent,
) => {
    let action = txn.get(actionAtom({ eventId, scopeId })) as DragAction
    if (action?.invalid || action === null) return null
    if (action.initialized === false) {
        const deltaX = Math.abs(action.initialMousePosition.x - clientX)
        const deltaY = Math.abs(action.initialMousePosition.y - clientX)
        if (!(deltaX > 3 || deltaY > 3)) {
            return
        } else {
            // Deselect items if dragging one that is not selected
            txn.set(actionAtom({ eventId, scopeId }), curr => ({
                ...curr,
                initialized: true,
            }))

            if (action.onDragStart) {
                action.onDragStart(event, eventId, txn)
                // We update the action in case the onDragStart modified it
                action = txn.get(actionAtom({ eventId, scopeId })) as DragAction
            }

            dropzones = txn.get(action.dropzonesSelector)
        }
    }

    // What is the point of this?
    if (dropzones.length === 0) {
        dropzones = txn.get(action.dropzonesSelector)
    }

    const dropZones = Object.entries(dropzones).map(([k, v]) => ({
        id: k,
        ...v,
    }))

    const scale = txn.get(scaleAtom(scopeId))
    const initMousePosX = action.initialMousePosition.x
    const initMousePosY = action.initialMousePosition.y
    const mouseOffsetX = action.mouseOffset.x
    const mouseOffsetY = action.mouseOffset.y

    const originPosition =
        typeof action?.originPosition === "function"
            ? action?.originPosition()
            : action?.originPosition
    const originSize =
        typeof action.originSize === "function"
            ? action.originSize()
            : action.originSize

    // localDeltaX is the relative distance from the initial drag point.
    const localDeltaX =
        (clientX + window.scrollX) / scale - initMousePosX / scale
    const localDeltaY =
        (clientY + window.scrollY) / scale - initMousePosY / scale

    const offsetX = mouseOffsetX / scale - originSize.w / 2
    const offsetY = mouseOffsetY / scale - originSize.h / 2

    // localX and localY is the position in the local coordinate space.
    const localX = originPosition.x + localDeltaX + mouseOffsetX / scale
    const localY = originPosition.y + localDeltaY + mouseOffsetY / scale

    const currentActiveDropzone = checkForActiveDropzone(
        dropZones,
        localX,
        localY,
    )

    if (currentActiveDropzone) {
        txn.set(actionAtom({ eventId, scopeId }), curr => ({
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
            x: localDeltaX + offsetX,
            y: localDeltaY + offsetY,
        }))

        if (action.activeDropzone) {
            txn.set(actionAtom({ eventId, scopeId }), curr => ({
                ...curr,
                activeDropzone: null,
            }))
        }
    }
}
