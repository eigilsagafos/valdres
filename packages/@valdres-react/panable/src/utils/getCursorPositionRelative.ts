import { cameraPositionAtom } from "../state/atoms/cameraPositionAtom"
import { cursorPositionAtom } from "../state/atoms/cursorPositionAtom"
import { innerCanvasSizeAtom } from "../state/atoms/innerCanvasSizeAtom"
import { outerCanvasSizeAtom } from "../state/atoms/outerCanvasSizeAtom"
import { scaleAtom } from "../state/atoms/scaleAtom"

export const calculateRelativeCursorPos = ({
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

export const getCursorPositionRelative = get => {
    const cursor = get(cursorPositionAtom)
    const camera = get(cameraPositionAtom)
    const outerCanvas = get(outerCanvasSizeAtom)
    const innerCanvas = get(innerCanvasSizeAtom)
    const scale = get(scaleAtom)
    return calculateRelativeCursorPos({
        cursor,
        camera,
        outerCanvas,
        scale,
        innerCanvas,
    })
}
