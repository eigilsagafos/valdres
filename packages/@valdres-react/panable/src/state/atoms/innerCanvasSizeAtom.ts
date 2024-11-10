import { atomFamily } from "valdres"
import type { ScopeId } from "../../types/ScopeId"

const DEFAULT_VALUE = Object.freeze({
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
})

export const innerCanvasSizeAtom = atomFamily<
    ScopeId,
    {
        left: number
        right: number
        bottom: number
        top: number
        width: number
        height: number
        x: number
        y: number
    }
>(DEFAULT_VALUE, {
    name: "@valdres-react/panable/innerCanvasSize",
})
