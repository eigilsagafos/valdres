import type { TransactionInterface } from "valdres-react"
import { finishAction } from "./finishAction"
import type { ScopeId } from "../../types/ScopeId"

export const onMouseUp = (
    txn: TransactionInterface,
    e: React.MouseEvent,
    scopeId: ScopeId,
    onCanvasClick: () => void,
) => {
    if (e.button === 2) return
    finishAction(txn, scopeId, "mouse", e, onCanvasClick)
}
