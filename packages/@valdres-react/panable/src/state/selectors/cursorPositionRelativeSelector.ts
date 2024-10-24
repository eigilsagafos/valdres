import { selectorFamily } from "valdres-react"
import type { Point } from "../../types/Point"
import { getCursorPositionRelative } from "../../utils/getCursorPositionRelative"
import { innerCanvasSizeAtom } from "../atoms/innerCanvasSizeAtom"

export const cursorPositionRelativeSelector = selectorFamily<
    { scopeId: string; innerCanvas?: boolean },
    Point
>(
    ({ scopeId, innerCanvas }) =>
        get => {
            const res = getCursorPositionRelative(get, scopeId)
            if (innerCanvas) {
                const size = get(innerCanvasSizeAtom(scopeId))
                const offsetY = size.height / 2
                res.y = res.y - offsetY
                return res
            } else {
                return res
            }
        },
    {
        label: "@valdres-react/panable/cursorPositionRelative",
    },
)
