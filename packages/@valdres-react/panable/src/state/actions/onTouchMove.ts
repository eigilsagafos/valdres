import type { Transaction } from "valdres"
import type { Action } from "../../types/Action"
import { actionAtom } from "../atoms/actionAtom"
import { cursorPositionAtom } from "../atoms/cursorPositionAtom"
import { drag } from "./drag"
import { move } from "./move"
// import { zoom } from "./zoom"

// const zoom = (recoil, initialScale, eventScale) => {
//     const newZoom = initialScale * eventScale
//     recoil.set(scaleAtom, newZoom)
//     // TODO: Make this position aware
// }

export const onTouchMove = (txn: Transaction, touchEvent: TouchEvent) => {
    const [...changedTouches] = touchEvent.changedTouches
    const actions: Action[] = []

    changedTouches.forEach(t => {
        const action = txn.get(actionAtom(t.identifier))
        if (action) actions.push(action)
    })

    if (actions.length > 0 && actions.every(action => action.kind === "zoom")) {
        throw new Error("TODO - fix")
        // zoom(state, actions[0].initialScale, touchEvent.scale)
    } else if (actions.length === 1) {
        const action = actions[0]
        const touch = changedTouches[0]
        if (action.kind === "move") {
            move(txn, action.eventId, touch.clientX, touch.clientY)
        } else if (action.kind === "drag") {
            // throw new Error("onTouchMove TODO drag")
            drag(txn, action.eventId, touch.clientX, touch.clientY, touchEvent)
        } else if (action.kind === "select") {
            txn.set(cursorPositionAtom, {
                x: touch.clientX,
                y: touch.clientY,
            })
        }
    }
}
