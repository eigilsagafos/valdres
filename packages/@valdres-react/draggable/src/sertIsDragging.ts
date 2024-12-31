import {
    activeActionsAtom,
    actionAtom,
    scaleAtom,
} from "@valdres-react/panable"
import type { TransactionInterface } from "valdres"

export const setIsDragging = (
    txn: TransactionInterface,
    x: number,
    y: number,
    {
        id,
        eventId,
        scopeId,
        meta,
        itemPos,
        itemSize,
        onDragStart,
        onDragInit,
        onDragEnd,
        onDrop,
        dropzonesSelector,
    },
    event,
) => {
    const scale = txn.get(scaleAtom(scopeId))
    txn.set(activeActionsAtom(scopeId), curr => [...curr, [eventId, "drag"]])
    txn.set(actionAtom({ eventId, scopeId }), {
        kind: "drag",
        id,
        meta,
        scopeId,
        eventId,
        initialized: false,
        x: x / scale,
        y: y / scale,
        originPosition: itemPos,
        originSize: itemSize,
        initialMousePosition: {
            x,
            y,
        },
        onDragStart,
        onDragEnd,
        onDrop,
        dropzonesSelector,
        event,
    })
    onDragInit && onDragInit(event, eventId, txn)
}
