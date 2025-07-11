import { draggableItemAtom } from "@valdres-react/draggable"
import type { TransactionInterface } from "valdres"
import type { ScopeId } from "../../types/ScopeId"
import { actionAtom } from "../atoms/actionAtom"
import { scaleAtom } from "../atoms/scaleAtom"

const checkForActiveDropzone = (
    zones: DropZone[],
    itemX: number,
    itemY: number,
): DropZone => {
    return zones.find(zone => {
        if (zone) {
            const { w, h, x, y } = zone
            const left = x
            const right = x + w
            const top = y - h / 2
            const bottom = y + h / 2
            const withinLeftBorder = itemX > left - w
            const withinRightBorder = itemX < right
            const withinTopBorder = itemY > top - h
            const withinBottomBorder = itemY < bottom
            return (
                withinLeftBorder &&
                withinRightBorder &&
                withinTopBorder &&
                withinBottomBorder
            )
        }
    })
}

let dropzones: DropZone[] = []
export const drag = (
    txn: TransactionInterface,
    scopeId: ScopeId,
    eventId: string | number,
    x: number,
    y: number,
    event: MouseEvent | TouchEvent,
) => {
    let action = txn.get(actionAtom({ eventId, scopeId }))
    if (action.invalid) return null
    if (action.initialized === false) {
        const xDiff = Math.abs(action.initialMousePosition.x - x)
        const yDiff = Math.abs(action.initialMousePosition.y - y)
        if (!(xDiff > 3 || yDiff > 3)) {
            return
        } else {
            //Deselect items if dragging one that is not selected
            txn.set(actionAtom({ eventId, scopeId }), curr => ({
                ...curr,
                initialized: true,
            }))

            if (action.onDragStart) {
                action.onDragStart(event, eventId, txn)
                // We update the action in case the onDragStart modified it
                action = txn.get(actionAtom({ eventId, scopeId }))
            }

            dropzones = txn.get(action.dropzonesSelector)
        }
    }

    const scale = txn.get(scaleAtom(scopeId))

    if (dropzones.length === 0) {
        dropzones = txn.get(action.dropzonesSelector)
    }

    const dropZones = Object.entries(dropzones).map(([k, v]) => ({
        id: k,
        ...v,
    }))

    const originPosition =
        typeof action.originPosition === "function"
            ? action.originPosition(state)
            : action.originPosition

    const xDiff = (x + window.scrollX) / scale - action.x
    const yDiff = (y + window.scrollY) / scale - action.y
    const realX = originPosition.x + xDiff
    const realY = originPosition.y + yDiff

    const currentActiveDropzone = checkForActiveDropzone(
        dropZones,
        realX,
        realY,
    )

    if (currentActiveDropzone) {
        txn.set(actionAtom({ eventId, scopeId }), curr => ({
            ...curr,
            activeDropzone: currentActiveDropzone,
        }))
        const originSize =
            typeof action.originSize === "function"
                ? action.originSize(state)
                : action.originSize
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
            x: xDiff,
            y: yDiff,
            isSnapping: false,
            isDragging: true,
        }))

        if (action.activeDropzone) {
            txn.set(actionAtom({ eventId, scopeId }), curr => ({
                ...curr,
                activeDropzone: null,
            }))
        }
    }
}
