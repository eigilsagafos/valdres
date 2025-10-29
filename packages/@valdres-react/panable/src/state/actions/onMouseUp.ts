import type { Transaction } from "valdres"
import { finishAction } from "./finishAction"

export const onMouseUp = (txn: Transaction, e: MouseEvent) => {
    if (e.button === 2) return
    finishAction(txn, "mouse", e)
}
