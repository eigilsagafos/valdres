import type { Transaction } from "valdres"
import { cameraPositionAtom } from "../atoms/cameraPositionAtom"
import { scaleAtom } from "../atoms/scaleAtom"
import { updateDragActionsAfterMove } from "./updateDragActionsAfterMove"

export const moveDelta = (txn: Transaction, x: number, y: number) => {
    const scale = txn.get(scaleAtom)
    const deltaX = x / scale
    const deltaY = y / scale
    updateDragActionsAfterMove(txn, deltaX, deltaY)
    txn.set(cameraPositionAtom, curr => ({
        x: curr.x - deltaX,
        y: curr.y - deltaY,
        animate: false,
    }))
}
