import { useCallback, useMemo, useRef } from "react"
import { useTransaction } from "valdres-react"
import { onMouseMove } from "../state/actions/onMouseMove"
import { onTouchMove } from "../state/actions/onTouchMove"
import { EventHandler } from "./EventHandler"
import { InnerCanvas } from "./InnerCanvas"
import { OuterCanvas } from "./OuterCanvas"
import { Selections } from "./Selections"
// import { PanableControls } from "./PanableControls"

import { type CSSProperties } from "react"

export interface PanableComponentArguments {
    width?: string
    height?: string
    defaultZoom?: number
    allowFullscreen?: boolean
    showControls?: boolean
    scopeId?: string
    select?: boolean
    onCanvasClick?: (txn?: any) => void
    children?: React.ReactNode
    backgroundColor?: CSSProperties["backgroundColor"]
}

export const Panable = ({
    width = "100%",
    height = "340px",
    defaultZoom = 0.5,
    allowFullscreen = true,
    showControls = true,
    select = false,
    onCanvasClick = undefined,
    scopeId = undefined,
    backgroundColor = undefined,
    outerChildren = undefined,
    children,
}: PanableComponentArguments) => {
    const outerRef = useRef<HTMLDivElement>()
    const innerRef = useRef<HTMLDivElement>()
    const txn = useTransaction()
    const scopeIdMemoized = useMemo(
        () => scopeId || crypto.randomUUID(),
        [scopeId],
    )

    const mouseMove = useCallback(
        e => {
            e.stopPropagation()
            txn(state => onMouseMove(state, e, scopeIdMemoized))
        },
        [scopeIdMemoized],
    )

    const touchMove = useCallback(
        e => {
            e.preventDefault()
            e.stopPropagation()
            txn(state => onTouchMove(state, e, scopeIdMemoized))
        },
        [scopeIdMemoized],
    )

    return (
        <OuterCanvas
            ref={outerRef}
            width={width}
            height={height}
            backgroundColor={backgroundColor}
            scopeId={scopeIdMemoized}
            onMouseMove={mouseMove}
            onTouchMove={touchMove}
        >
            <EventHandler
                scopeId={scopeIdMemoized}
                select={select}
                onCanvasClick={onCanvasClick}
            >
                <InnerCanvas ref={innerRef} scopeId={scopeIdMemoized}>
                    <Selections scopeId={scopeIdMemoized} />
                    {children}
                </InnerCanvas>
            </EventHandler>
            {outerChildren}
            {/* {showControls && (
                 <PanableControls
                     outerRef={outerRef}
                     defaultZoom={defaultZoom}
                     allowFullscreen={allowFullscreen}
                     scopeId={scopeIdMemoized}
                 />
            )} */}
        </OuterCanvas>
    )
}
