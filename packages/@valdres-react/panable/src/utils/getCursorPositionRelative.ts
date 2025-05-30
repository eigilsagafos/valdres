import { cameraPositionAtom } from "../state/atoms/cameraPositionAtom"
import { cursorPositionAtom } from "../state/atoms/cursorPositionAtom"
import { innerCanvasSizeAtom } from "../state/atoms/innerCanvasSizeAtom"
import { outerCanvasSizeAtom } from "../state/atoms/outerCanvasSizeAtom"
import { scaleAtom } from "../state/atoms/scaleAtom"

const calculateRelativeCursorPos = ({
    cursor,
    camera,
    outerCanvas,
    scale,
    innerCanvas,
}) => {
    const xOffset =
        (outerCanvas.width - outerCanvas.width / scale) / 2 -
        camera.x -
        outerCanvas.left +
        (outerCanvas.left - outerCanvas.left / scale)

    const yOffset =
        (outerCanvas.height - outerCanvas.height / scale) / 2 -
        camera.y -
        outerCanvas.height / 2 -
        innerCanvas.height / 2 +
        innerCanvas.height -
        outerCanvas.top +
        (outerCanvas.top - outerCanvas.top / scale)

    return {
        x: cursor.x / scale + xOffset,
        y: cursor.y / scale + yOffset,
    }
}

export const getCursorPositionRelative = (get, scopeId) => {
    const cursor = get(cursorPositionAtom(scopeId))
    const camera = get(cameraPositionAtom(scopeId))
    const outerCanvas = get(outerCanvasSizeAtom(scopeId))
    const innerCanvas = get(innerCanvasSizeAtom(scopeId))
    const scale = get(scaleAtom(scopeId))
    return calculateRelativeCursorPos({
        cursor,
        camera,
        outerCanvas,
        scale,
        innerCanvas,
    })
}
