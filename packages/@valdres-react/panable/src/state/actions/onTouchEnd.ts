import type { Transaction } from "valdres"
import { finishAction } from "./finishAction"

export const onTouchEnd = (txn: Transaction, e: TouchEvent) => {
    const [...changedTouches] = e.changedTouches
    changedTouches.forEach(t => {
        finishAction(txn, t.identifier, e)
    })
}
