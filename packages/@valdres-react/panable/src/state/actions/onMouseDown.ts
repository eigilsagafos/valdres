// import { currentCapabilitesSelector } from "../../../state/selectors/currentCapabilitesSelector"
import type { TransactionInterface } from "valdres-react"
import { initMove } from "./initMove"
import { initSelect } from "./initSelect"
import type { ScopeId } from "../../types/ScopeId"

export const onMouseDown = (
    txn: TransactionInterface,
    e: React.MouseEvent,
    scopeId: ScopeId,
    select: boolean,
) => {
    if (e.button === 2) return
    if (select) {
        e.preventDefault()
        initSelect(txn, scopeId, "mouse", e)
    } else {
        // const capabilities = state.get(currentCapabilitesSelector)
        // if (capabilities.actions.pan.enabled) {
        e.preventDefault()
        console.log("asd2")
        initMove(txn, scopeId, "mouse", e.clientX, e.clientY, e.timeStamp)
        // }
    }
}
