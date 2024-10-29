import {
    activeActionsAtom,
    actionAtom,
    scaleAtom,
} from "@valdres-react/panable"
import type { TransactionInterface } from "valdres-react"

export const setIsDragging = (
    txn: TransactionInterface,
    x: number,
    y: number,
    {
        eventId,
        scopeId,
        meta,
        itemPos,
        itemSize,
        onDragStart,
        onDragInit,
        onDragEnd,
        onDrop,
    },
) => {
    const scale = txn.get(scaleAtom(scopeId))
    txn.set(activeActionsAtom(scopeId), curr => [...curr, [eventId, "drag"]])
    txn.set(actionAtom({ eventId, scopeId }), {
        kind: "drag",
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
    })
    onDragInit && onDragInit(txn, { eventId, scopeId })
}