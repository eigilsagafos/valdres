import type { Transaction } from "valdres"
import { getCursorPositionRelative } from "../../utils/getCursorPositionRelative"
import { cameraPositionAtom } from "../atoms/cameraPositionAtom"
import { scaleAtom } from "../atoms/scaleAtom"

export const zoom = (txn: Transaction, zoomY: number) => {
    // const capabilities = state.get(currentCapabilitesSelector)
    const currentZoom = txn.get(scaleAtom)
    const clipValue = 25
    const zoomYClipped = Math.min(Math.max(zoomY, -clipValue), clipValue) // Clip deltaY when values become too big. E.g scrollwheel on external mouse on Windows.
    const zoomChange = zoomYClipped / 100
    const zoomAsFraction =
        zoomChange > 0
            ? 1 / (Math.abs(zoomChange) + 1)
            : 1 + Math.abs(zoomChange)
    let newZoom = currentZoom * zoomAsFraction

    if (newZoom > 8.0) newZoom = 8.0
    if (newZoom < 0.1) newZoom = 0.1
    const mouseBefore = getCursorPositionRelative(txn.get)
    txn.set(scaleAtom, newZoom)
    const mouseAfter = getCursorPositionRelative(txn.get)
    const xDiff = mouseBefore.x - mouseAfter.x
    const yDiff = mouseBefore.y - mouseAfter.y

    txn.set(cameraPositionAtom, curr => ({
        x: curr.x - xDiff,
        y: curr.y - yDiff,
        animate: false,
    }))
    // if (capabilities.actions.zoom.enabled) {
    // }
}
