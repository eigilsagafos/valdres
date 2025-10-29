import type { Transaction } from "valdres"
import { actionAtom } from "../atoms/actionAtom"
import { cursorPositionAtom } from "../atoms/cursorPositionAtom"
import { drag } from "./drag"
import { move } from "./move"

export const onMouseMove = (txn: Transaction, e: MouseEvent) => {
    const action = txn.get(actionAtom("mouse"))
    const { clientX: x, clientY: y } = e
    txn.set(cursorPositionAtom, { x, y })
    if (action) {
        e.preventDefault()

        if (action.kind === "drag") {
            drag(txn, action.eventId, x, y, e)
        } else if (action.kind === "select") {
            // Should we just ignore this?
            // updateSelect(action, x, y, get, set)
        } else {
            move(txn, action.eventId, x, y)
        }
    }
}
