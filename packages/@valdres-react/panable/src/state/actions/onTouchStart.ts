import type { Transaction } from "valdres"
import type { Action } from "../../types/Action"
import { actionAtom } from "../atoms/actionAtom"
import { activeActionsAtom } from "../atoms/activeActionsAtom"
import { configAtom } from "../atoms/configAtom"
import { initMove } from "./initMove"
import { initSelect } from "./initSelect"
import { initZoom } from "./initZoom"
import { upgradeMoveToZoom } from "./upgradeMoveToZoom"

export const onTouchStart = (txn: Transaction, e: TouchEvent) => {
    const [...touches] = e.touches
    const [...changedTouches] = e.changedTouches
    const timeStamp = e.timeStamp

    const targetEvents: Action[] = []
    touches.map(t => {
        const action = txn.get(actionAtom(t.identifier))
        if (action) targetEvents.push(action)
    })

    if (changedTouches.length === 1) {
        const activeActions = txn
            .get(activeActionsAtom)
            .map(([eventId]) => txn.get(actionAtom(eventId)))

        const movingAction = activeActions.find(
            action => action?.kind === "move",
        )
        if (movingAction) {
            const t = changedTouches[0]
            const eventDiff = e.timeStamp - movingAction.timeStamp
            if (eventDiff < 250) {
                upgradeMoveToZoom(txn, movingAction.eventId, t)
            }
        } else {
            const t = changedTouches[0]
            const { mode } = txn.get(configAtom)
            if (mode === "select") {
                initSelect(txn, t.identifier, e)
            } else {
                initMove(txn, t.identifier, t.clientX, t.clientY, timeStamp)
            }
        }
    } else if (changedTouches.length === 2) {
        const [t1, t2] = changedTouches
        initZoom(txn, t1, t2)
    }
}
