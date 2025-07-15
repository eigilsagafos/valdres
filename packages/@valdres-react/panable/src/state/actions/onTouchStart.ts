import type { Transaction } from "valdres"
import type { Action } from "../../types/Action"
import type { ScopeId } from "../../types/ScopeId"
import { actionAtom } from "../atoms/actionAtom"
import { activeActionsAtom } from "../atoms/activeActionsAtom"
import { initMove } from "./initMove"
import { initSelect } from "./initSelect"
import { initZoom } from "./initZoom"
import { upgradeMoveToZoom } from "./upgradeMoveToZoom"
import { configAtom } from "../atoms/configAtom"

export const onTouchStart = (
    txn: Transaction,
    e: TouchEvent,
    scopeId: ScopeId,
) => {
    const [...touches] = e.touches
    const [...changedTouches] = e.changedTouches
    const timeStamp = e.timeStamp

    const targetEvents: Action[] = []
    touches.map(t => {
        const action = txn.get(actionAtom({ eventId: t.identifier, scopeId }))
        if (action) targetEvents.push(action)
    })

    if (changedTouches.length === 1) {
        const activeActions = txn
            .get(activeActionsAtom(scopeId))
            .map(([eventId]) => txn.get(actionAtom({ eventId, scopeId })))

        const movingAction = activeActions.find(
            action => action?.kind === "move",
        )
        if (movingAction) {
            const t = changedTouches[0]
            const eventDiff = e.timeStamp - movingAction.timeStamp
            if (eventDiff < 250) {
                upgradeMoveToZoom(txn, scopeId, movingAction.eventId, t)
            }
        } else {
            const t = changedTouches[0]
            const { mode } = txn.get(configAtom(scopeId))
            if (mode === "select") {
                initSelect(txn, scopeId, t.identifier, e)
            } else {
                initMove(
                    txn,
                    scopeId,
                    t.identifier,
                    t.clientX,
                    t.clientY,
                    timeStamp,
                )
            }
        }
    } else if (changedTouches.length === 2) {
        const [t1, t2] = changedTouches
        initZoom(txn, scopeId, t1, t2)
    }
}
