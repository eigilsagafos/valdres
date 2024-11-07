import { selectorFamily } from "valdres-react"
import type { Point } from "../../types/Point"
import type { ScopeId } from "../../types/ScopeId"
import { getCursorPositionRelative } from "../../utils/getCursorPositionRelative"
import { innerCanvasSizeAtom } from "../atoms/innerCanvasSizeAtom"

export const cursorPositionRelativeSelector = selectorFamily<
    { scopeId: ScopeId; innerCanvas?: boolean },
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
        name: "@valdres-react/panable/cursorPositionRelative",
    },
)
