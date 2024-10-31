import { draggableItemAtom } from "@valdres-react/draggable"
import { actionAtom, scaleAtom } from "@valdres-react/panable"
import type { TransactionInterface } from "valdres-react"
import type { ScopeId } from "../../types/ScopeId"
// import { DropZone } from '../../../types/DropZone'
// import { deselectProcessItems } from '../../../state/utils/deselectProcessItems'
// import { selectedProcessItemsSelector } from '../../../state/selectors/selectedProcessItemsSelector'
// import { allDropZonesByScopeIdSelector } from '../../../state/selectors/allDropZonesByScopeIdSelector'

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

export const drag = (
    txn: TransactionInterface,
    scopeId: ScopeId,
    eventId: string | number,
    x: number,
    y: number,
) => {
    let action = txn.get(actionAtom({ eventId, scopeId }))
    if (action.invalid) return null

    // const draggableId = {
    //     ref: action.meta.item.ref,
    //     context: action.meta.item.context,
    //     scopeId,
    // }

    if (action.initialized === false) {
        const xDiff = Math.abs(action.initialMousePosition.x - x)
        const yDiff = Math.abs(action.initialMousePosition.y - y)
        if (!(xDiff > 3 || yDiff > 3)) {
            return
        } else {
            //Deselect items if dragging one that is not selected
            console.log("onInit on action?")
            // const selected = state.get(selectedProcessItemsSelector(scopeId))
            // if (!selected.find(item => item.ref === action.id.ref)) {
            //     deselectProcessItems(state, scopeId)
            //     state.set(actionAtom({ eventId, scopeId }), curr => ({
            //         ...curr,
            //         meta: {
            //             ...curr.meta,
            //             otherItems: [],
            //         },
            //     }))
            // }

            txn.set(actionAtom({ eventId, scopeId }), curr => ({
                ...curr,
                initialized: true,
            }))
            if (action.onDragStart) {
                action.onDragStart(txn, { scopeId, eventId, action })
                // We update the action in case the onDragStart modified it
                action = txn.get(actionAtom({ eventId, scopeId }))
            }
        }
    }

    const scale = txn.get(scaleAtom(scopeId))
    console.log(action)
    const dropzones = txn.get(action.dropzonesSelector)

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
