import type { TransactionInterface } from "valdres-react"
import type { ScopeId } from "../../types/ScopeId"
import { finishAction } from "./finishAction"

export const onTouchEnd = (
    txn: TransactionInterface,
    e: TouchEvent,
    scopeId: ScopeId,
    onCanvasClick: () => void,
) => {
    const [...changedTouches] = e.changedTouches
    changedTouches.forEach(t => {
        finishAction(txn, scopeId, t.identifier, e, onCanvasClick)
    })
}
