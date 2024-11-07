import { atomFamily } from "valdres-react"
import type { ScopeId } from "../../types/ScopeId"

const DEFAULT_VALUE = Object.freeze({
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
})

export const outerCanvasSizeAtom = atomFamily<
    ScopeId,
    {
        bottom: number
        left: number
        right: number
        top: number
        width: number
        height: number
        x: number
        y: number
    }
>(DEFAULT_VALUE, {
    name: "panable/outerCanvasSize",
})
