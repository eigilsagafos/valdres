import type { Transaction } from "valdres"
import { configAtom } from "../atoms/configAtom"
import { initMove } from "./initMove"
import { initSelect } from "./initSelect"

export const onMouseDown = (txn: Transaction, e: MouseEvent) => {
    const { mode } = txn.get(configAtom)
    if (e.button === 2) return
    if (mode === "select") {
        e.preventDefault()
        initSelect(txn, "mouse", e)
    } else {
        e.preventDefault()
        initMove(txn, "mouse", e.clientX, e.clientY, e.timeStamp)
    }
}
