import React, { type CSSProperties } from "react"
import type { Selector } from "valdres"
import { useValue } from "valdres-react"
import type { Size } from "../../../draggable/src/types/Size"
import type { Point } from "../types/Point"

export const PositionAbsolute = ({
    children,
    sizeSelector,
    positionSelector,
    zIndex = 3,
    offsetY = 0,
    ...rest
}: {
    children: React.ElementType
    sizeSelector: Selector<Size>
    positionSelector: Selector<Point>
    zIndex?: CSSProperties["zIndex"]
    offsetY?: number
}) => {
    const size = useValue(sizeSelector)
    const pos = useValue(positionSelector)
    const transform = `translate3d(${pos.x}px, ${pos.y + offsetY}px, 0)`
    return (
        <div
            style={{
                transform,
                zIndex,
                width: `${size.w}px`,
                height: `${size.h}px`,
                position: "absolute",
                willChange: "z-index, transform",
            }}
            {...rest}
        >
            {children}
        </div>
    )
}
