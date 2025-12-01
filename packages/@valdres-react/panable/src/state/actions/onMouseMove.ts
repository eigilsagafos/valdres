import type { Store } from "valdres"
import { actionAtom } from "../atoms/actionAtom"
import { cursorPositionAtom } from "../atoms/cursorPositionAtom"
import { drag } from "./drag"
import { move } from "./move"

export const onMouseMove = (e: MouseEvent, store: Store) => {
    const action = store.get(actionAtom("mouse"))
    const { clientX: x, clientY: y } = e
    store.set(cursorPositionAtom, { x, y })
    if (action) {
        e.preventDefault()

        if (action.kind === "drag") {
            drag(action.eventId, x, y, e, store)
        } else if (action.kind === "select") {
            // Should we just ignore this?
            // updateSelect(action, x, y, get, set)
        } else {
            move(action.eventId, x, y, store)
        }
    }
}
