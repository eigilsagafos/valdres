import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    type ReactElement,
} from "react"
import { type Transaction } from "valdres"
import { useStore, useTransaction } from "valdres-react"
import { onMouseMove } from "../state/actions/onMouseMove"
import { onTouchMove } from "../state/actions/onTouchMove"
import { configAtom } from "../state/atoms/configAtom"
import { EventHandler } from "./EventHandler"
import { InnerCanvas } from "./InnerCanvas"
import { OuterCanvas } from "./OuterCanvas"
import { Selections } from "./Selections"
// import { PanableControls } from "./PanableControls"

import { type CSSProperties } from "react"
import { cameraPositionAtom } from "../state/atoms/cameraPositionAtom"
import { scaleAtom } from "../state/atoms/scaleAtom"

export interface PanableComponentArguments {
    width?: string
    height?: string
    defaultZoom?: number
    defaultOffset?: { x: number; y: number }
    allowFullscreen?: boolean
    showControls?: boolean
    select?: boolean
    children?: React.ReactNode
    outerChildren?: ReactElement
    backgroundColor?: CSSProperties["backgroundColor"]
    mode: "pan" | "select"
    onCanvasClick?: (txn?: any) => void
    onSelectInit?: (txn: Transaction) => void
}

const useInitPanableConfig = config => {
    const store = useStore()
    useMemo(() => {
        if (store.data.values.get(configAtom) === undefined) {
            store.data.values.set(configAtom, config)
        }

        if (config?.defaultZoom) {
            store.set(scaleAtom, config.defaultZoom)
        }

        if (config?.defaultOffset) {
            store.set(cameraPositionAtom, state => {
                return {
                    ...state,
                    x: config?.defaultOffset?.x ?? 100,
                    y: config?.defaultOffset.y ?? 0,
                }
            })
        }
    }, [])

    useEffect(() => {
        store.set(configAtom, config)
    }, [config])
}

export const Panable = ({
    width = "100%",
    height = "340px",
    mode = "pan",
    defaultZoom = 0.5,
    defaultOffset = { x: 100, y: 0 },
    allowFullscreen = true,
    showControls = true,
    backgroundColor = undefined,
    outerChildren = undefined,
    onCanvasClick = undefined,
    onSelectInit = undefined,
    children,
}: PanableComponentArguments) => {
    const outerRef = useRef<HTMLDivElement>()
    const innerRef = useRef<HTMLDivElement>()
    const store = useStore()
    const txn = useTransaction()

    useInitPanableConfig({
        onSelectInit,
        onCanvasClick,
        mode,
        defaultZoom,
        defaultOffset,
    })

    const mouseMove = useCallback((e: MouseEvent) => {
        e.stopPropagation()
        onMouseMove(e, store)
    }, [store])

    const touchMove = useCallback((e: TouchEvent) => {
        e.preventDefault()
        e.stopPropagation()
        txn(state => onTouchMove(state, e))
    }, [])

    return (
        <OuterCanvas
            ref={outerRef}
            width={width}
            height={height}
            backgroundColor={backgroundColor}
            onMouseMove={mouseMove}
            onTouchMove={touchMove}
        >
            <EventHandler>
                <InnerCanvas ref={innerRef}>
                    <Selections />
                    {children}
                </InnerCanvas>
            </EventHandler>
            {outerChildren && <>{outerChildren}</>}
            {/* {showControls && (
                 <PanableControls
                     outerRef={outerRef}
                     defaultZoom={defaultZoom}
                     allowFullscreen={allowFullscreen}
                 />
            )} */}
        </OuterCanvas>
    )
}
