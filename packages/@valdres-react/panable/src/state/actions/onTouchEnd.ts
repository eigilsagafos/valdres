import type { Transaction } from "valdres"
import type { ScopeId } from "../../types/ScopeId"
import { finishAction } from "./finishAction"

export const onTouchEnd = (
    txn: Transaction,
    e: TouchEvent,
    scopeId: ScopeId,
) => {
    const [...changedTouches] = e.changedTouches
    changedTouches.forEach(t => {
        finishAction(txn, scopeId, t.identifier, e)
    })
}
