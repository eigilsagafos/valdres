import {
    actionAtom,
    activeActionsAtom,
    type EventId,
    type ScopeId,
} from "@valdres-react/panable"
import type { Selector, Transaction } from "valdres"
import type { Point } from "../types/Point"
import type { Size } from "../types/Size"
import type { EventCallbackFn } from "../types/EventCallbackFn"

export const setIsDragging = (
    txn: Transaction,
    x: number,
    y: number,
    {
        id,
        eventId,
        scopeId,
        meta,
        originPosition,
        originSize,
        onDragStart,
        onDragInit,
        onDragEnd,
        onDrop,
        dropzonesSelector,
    }: {
        id: any
        eventId: EventId
        scopeId: ScopeId
        meta: any
        originPosition: Point
        originSize: Size
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

    txn.set(activeActionsAtom(scopeId), curr => [...curr, [eventId, "drag"]])
    txn.set(actionAtom({ eventId, scopeId }), {
        kind: "drag",
        id,
        meta,
        scopeId,
        eventId,
        initialized: false,
        originPosition,
        originSize,
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
}
