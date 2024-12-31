import type { TransactionInterface } from "valdres"
import { scaleAtom } from "../atoms/scaleAtom"
import { getCursorPositionRelative } from "../../utils/getCursorPositionRelative"
import { cameraPositionAtom } from "../atoms/cameraPositionAtom"
import type { ScopeId } from "../../types/ScopeId"

export const zoom = (
    txn: TransactionInterface,
    zoomY: number,
    scopeId: ScopeId,
) => {
    // const capabilities = state.get(currentCapabilitesSelector)
    const currentZoom = txn.get(scaleAtom(scopeId))
    const clipValue = 25
    const zoomYClipped = Math.min(Math.max(zoomY, -clipValue), clipValue) // Clip deltaY when values become too big. E.g scrollwheel on external mouse on Windows.
    const zoomChange = zoomYClipped / 100
    const zoomAsFraction =
        zoomChange > 0
            ? 1 / (Math.abs(zoomChange) + 1)
            : 1 + Math.abs(zoomChange)
    const newZoom = currentZoom * zoomAsFraction

    if (newZoom < 0.1 || newZoom > 4.0) return
    const mouseBefore = getCursorPositionRelative(txn.get, scopeId)
    txn.set(scaleAtom(scopeId), newZoom)
    const mouseAfter = getCursorPositionRelative(txn.get, scopeId)
    const xDiff = mouseBefore.x - mouseAfter.x
    const yDiff = mouseBefore.y - mouseAfter.y

    txn.set(cameraPositionAtom(scopeId), curr => ({
        x: curr.x - xDiff,
        y: curr.y - yDiff,
        animate: false,
    }))
    // if (capabilities.actions.zoom.enabled) {
    // }
}
