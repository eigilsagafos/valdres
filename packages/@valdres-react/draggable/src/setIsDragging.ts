import {
    activeActionsAtom,
    actionAtom,
    scaleAtom,
} from "@valdres-react/panable"
import type { Transaction } from "valdres"

export const setIsDragging = (
    txn: Transaction,
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
        centerDragSource,
    },
    event,
) => {
    const center = ({ x, scale }) => {
        if (centerDragSource) {
            const rect = event.currentTarget.getBoundingClientRect()
            const offsetX = event.clientX - rect.left
            return (x - offsetX + 12) / scale
        }

        return x / scale
    }

    const scale = txn.get(scaleAtom(scopeId))
    txn.set(activeActionsAtom(scopeId), curr => [...curr, [eventId, "drag"]])
    txn.set(actionAtom({ eventId, scopeId }), {
        kind: "drag",
        id,
        meta,
        scopeId,
        eventId,
        initialized: false,
        x: center({ x, scale }),
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
