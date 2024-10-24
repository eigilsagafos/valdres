import React from "react"
import { useValue } from "valdres-react"
import { actionAtom } from "../state/atoms/actionAtom"
import { usePanableEvents } from "../state/hooks/usePanableEvents"

export const EventHandler = ({
    scopeId,
    children,
    onCanvasClick,
    select = false,
}: {
    children: React.ReactNode
    select: boolean
    scopeId: string
    onCanvasClick?: any
}) => {
    const isMouseDragging = useValue(actionAtom({ eventId: "mouse", scopeId }))
    const cursor = select ? "default" : isMouseDragging ? "grabbing" : "grab"
    const ref = usePanableEvents({ scopeId, select, onCanvasClick })
    return (
        <div
            style={{
                cursor,
                width: "100%",
                height: "100%",
                touchAction: "none",
            }}
            ref={ref}
        >
            {children}
        </div>
    )
}
