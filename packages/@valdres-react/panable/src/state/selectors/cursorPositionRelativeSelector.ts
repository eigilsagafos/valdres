import { selectorFamily } from "valdres"
import type { Point } from "../../types/Point"
import { getCursorPositionRelative } from "../../utils/getCursorPositionRelative"
import { innerCanvasSizeAtom } from "../atoms/innerCanvasSizeAtom"

export const cursorPositionRelativeSelector = selectorFamily<Point>(
    (innerCanvas = false) =>
        get => {
            const res = getCursorPositionRelative(get)
            if (innerCanvas) {
                const size = get(innerCanvasSizeAtom)
                const offsetY = size.height / 2
                res.y = res.y - offsetY
                return res
            } else {
                return res
            }
        },
    { name: "@valdres-react/panable/cursorPositionRelative" },
)
