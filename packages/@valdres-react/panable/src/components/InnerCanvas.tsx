import React, { useEffect, useRef } from "react"
import { innerCanvasSizeAtom } from "../state/atoms/innerCanvasSizeAtom"
import { useCameraPosition } from "../state/hooks/useCameraPosition"
import { useScale } from "../state/hooks/useScale"
import { useUpdateAtomRectOnSizeChange } from "../state/hooks/useUpdateAtomRectOnSizeChange"
import type { Point } from "../types/Point"
import type { ScopeId } from "../types/ScopeId"

export const distanceBetween = (a: Point, b: Point) => {
    const x = a.x - b.x
    const y = a.y - b.y
    return Math.sqrt(x * x + y * y)
}

const calculateAnimationTime = (a: Point, b: Point) => {
    const ms = distanceBetween(a, b) * 0.6
    return ms < 200 ? 200 : ms
}

export const InnerCanvas = React.forwardRef<
    any,
    { children: React.ReactNode; scopeId: ScopeId }
>(({ children, scopeId }, ref) => {
    const scale = useScale(scopeId)
    const { x, y, animate } = useCameraPosition(scopeId)
    const transform = `scale(${scale}) translate3d(${x}px, ${y}px, 0) translateZ(0)`
    useUpdateAtomRectOnSizeChange(ref, innerCanvasSizeAtom(scopeId), scopeId)
    const oldVal = useRef<Point>({ x: 0, y: 0 })
    const animationTime = animate
        ? calculateAnimationTime({ x, y }, oldVal.current)
        : 0
    useEffect(() => {
        oldVal.current = { x, y }
    }, [x, y])
    return (
        <div
            style={{
                height: "100%",
                width: "100%",
                display: "flex",
                willChange: "transform",
                backfaceVisibility: "hidden",
                alignItems: "center",
                transform,
                WebkitPerspective: "1000",
                transition: `${animationTime}ms ease-out`,
            }}
        >
            <div
                id="innerPanableCanvas"
                ref={ref}
                style={{
                    position: "relative",
                }}
            >
                {children}
            </div>
        </div>
    )
})