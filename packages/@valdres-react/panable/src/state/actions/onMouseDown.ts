// import { currentCapabilitesSelector } from "../../../state/selectors/currentCapabilitesSelector"
import type { TransactionInterface } from "valdres"
import { initMove } from "./initMove"
import { initSelect } from "./initSelect"
import type { ScopeId } from "../../types/ScopeId"
import { configAtom } from "../atoms/configAtom"

export const onMouseDown = (
    txn: TransactionInterface,
    e: MouseEvent,
    scopeId: ScopeId,
) => {
    const { mode } = txn.get(configAtom(scopeId))
    if (e.button === 2) return
    if (mode === "select") {
        e.preventDefault()
        initSelect(txn, scopeId, "mouse", e)
    } else {
        // const capabilities = state.get(currentCapabilitesSelector)
        // if (capabilities.actions.pan.enabled) {
        e.preventDefault()
        initMove(txn, scopeId, "mouse", e.clientX, e.clientY, e.timeStamp)
        // }
    }
}
