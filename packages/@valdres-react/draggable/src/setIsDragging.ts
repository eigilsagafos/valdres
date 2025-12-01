import {
    actionAtom,
    activeActionsAtom,
    type EventId,
} from "@valdres-react/panable"
import type { Selector, Transaction } from "valdres"
import type { EventCallbackFn } from "../types/EventCallbackFn"
import type { Point } from "../types/Point"
import type { Size } from "../types/Size"

export const setIsDragging = (
    txn: Transaction,
    x: number,
    y: number,
    {
        id,
        eventId,
        meta,
        itemPos,
        itemSize,
        onDragStart,
        onDragInit,
        onDragEnd,
        onDrop,
        dropzonesSelector,
    }: {
        id: any
        eventId: EventId
        meta: any
        itemPos: () => Point
        itemSize: () => Size
        onDragStart: EventCallbackFn
        onDragInit: EventCallbackFn
        onDragEnd: EventCallbackFn
        onDrop: EventCallbackFn
        dropzonesSelector: Selector
    },
    event: MouseEvent | TouchEvent,
) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const offsetX = event.clientX - rect.left
    const offsetY = event.clientY - rect.top

    txn.set(actionAtom(eventId), {
        kind: "drag",
        id,
        meta,
        eventId,
        initialized: false,
        itemPos,
        itemSize,
        initialMousePosition: {
            x,
            y,
        },
        mouseOffset: {
            x: offsetX,
            y: offsetY,
        },
        onDragStart,
        onDragEnd,
        onDrop,
        dropzonesSelector,
        event,
    })
    onDragInit && onDragInit(event, eventId, txn)

    txn.set(activeActionsAtom, curr => [...curr, [eventId, "drag"]])
}
