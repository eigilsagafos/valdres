import type { Transaction } from "valdres"
import type { ScopeId } from "../../types/ScopeId"
import { actionAtom } from "../atoms/actionAtom"
import { cursorPositionAtom } from "../atoms/cursorPositionAtom"
import { move } from "./move"
import { drag } from "./drag"

export const onMouseMove = (
    txn: Transaction,
    e: MouseEvent,
    scopeId: ScopeId,
) => {
    const action = txn.get(actionAtom({ eventId: "mouse", scopeId }))
    const { clientX: x, clientY: y } = e
    txn.set(cursorPositionAtom(scopeId), { x, y })
    if (action) {
        e.preventDefault()

        if (action.kind === "drag") {
            drag(txn, scopeId, action.eventId, x, y, e)
        } else if (action.kind === "select") {
            // Should we just ignore this?
            // updateSelect(action, scopeId, x, y, get, set)
        } else {
            move(txn, scopeId, action.eventId, x, y)
        }
    }
}
