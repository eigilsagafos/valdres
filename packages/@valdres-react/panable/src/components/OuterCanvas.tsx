import { type CSSProperties, forwardRef, memo, useEffect } from "react"
import { useUpdateAtomRectOnSizeChange } from "../state/hooks/useUpdateAtomRectOnSizeChange"
import { outerCanvasSizeAtom } from "../state/atoms/outerCanvasSizeAtom"
import type { ScopeId } from "../types/ScopeId"

export const OuterCanvas = memo(
    forwardRef<
        HTMLDivElement,
        {
            width: string
            height: string
            children: JSX.Element[]
            backgroundColor: CSSProperties["backgroundColor"]
            scopeId: ScopeId
            onMouseMove: any
            onTouchMove: any
        }
    >(
        (
            {
                children,
                width,
                height,
                scopeId,
                onMouseMove,
                onTouchMove,
                backgroundColor = "#ffffff",
            },
            ref,
        ) => {
            useUpdateAtomRectOnSizeChange(
                ref,
                outerCanvasSizeAtom(scopeId),
                scopeId,
            )

            useEffect(() => {
                if (ref != null && typeof ref !== "function" && ref?.current) {
                    const domElement = ref?.current

                    if (onMouseMove) {
                        document.addEventListener("mousemove", onMouseMove, {
                            passive: false,
                        })
                    }
                    if (onTouchMove) {
                        domElement.addEventListener("touchmove", onTouchMove, {
                            passive: false,
                        })
                    }

                    return () => {
                        if (onMouseMove) {
                            document?.removeEventListener(
                                "mousemove",
                                onMouseMove,
                            )
                        }
                        if (onTouchMove) {
                            domElement?.removeEventListener(
                                "touchmove",
                                onTouchMove,
                            )
                        }
                    }
                }
            }, [scopeId, onMouseMove, onTouchMove])

            return (
                <div
                    id="canvas"
                    ref={ref}
                    style={{
                        position: "relative",
                        backgroundColor,
                        width,
                        height,
                        left: 0,
                        top: 0,
                        overflow: "hidden",
                        willChange: "width, height",
                    }}
                >
                    {children}
                </div>
            )
        },
    ),
)
