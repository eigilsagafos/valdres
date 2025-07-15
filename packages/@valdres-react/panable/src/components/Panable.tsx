import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    type ReactElement,
} from "react"
import { useStore, useTransaction } from "valdres-react"
import { type Transaction } from "valdres"
import { onMouseMove } from "../state/actions/onMouseMove"
import { onTouchMove } from "../state/actions/onTouchMove"
import { configAtom } from "../state/atoms/configAtom"
import { EventHandler } from "./EventHandler"
import { InnerCanvas } from "./InnerCanvas"
import { OuterCanvas } from "./OuterCanvas"
import { Selections } from "./Selections"
// import { PanableControls } from "./PanableControls"

import { type CSSProperties } from "react"
import type { ScopeId } from "../types/ScopeId"
import { scaleAtom } from "../state/atoms/scaleAtom"
import { cameraPositionAtom } from "../state/atoms/cameraPositionAtom"

export interface PanableComponentArguments {
    width?: string
    height?: string
    defaultZoom?: number
    defaultOffset?: { x: number; y: number }
    allowFullscreen?: boolean
    showControls?: boolean
    scopeId?: string
    select?: boolean
    children?: React.ReactNode
    outerChildren?: ReactElement
    backgroundColor?: CSSProperties["backgroundColor"]
    mode: "pan" | "select"
    onCanvasClick?: (txn?: any) => void
    onSelectInit?: (txn: Transaction) => void
}

const useInitPanableConfig = (scopeId: ScopeId, config) => {
    const store = useStore()
    useMemo(() => {
        if (store.data.values.get(configAtom(scopeId)) === undefined) {
            store.data.values.set(configAtom(scopeId), config)
        }

        if (config?.defaultZoom) {
            store.set(scaleAtom(scopeId), config.defaultZoom)
        }

        if (config?.defaultOffset) {
            store.set(cameraPositionAtom(scopeId), state => {
                return {
                    ...state,
                    x: config?.defaultOffset?.x ?? 100,
                    y: config?.defaultOffset.y ?? 0,
                }
            })
        }
    }, [])

    useEffect(() => {
        store.set(configAtom(scopeId), config)
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
    scopeId = undefined,
    backgroundColor = undefined,
    outerChildren = undefined,
    onCanvasClick = undefined,
    onSelectInit = undefined,
    children,
}: PanableComponentArguments) => {
    const outerRef = useRef<HTMLDivElement>()
    const innerRef = useRef<HTMLDivElement>()
    const txn = useTransaction()
    const scopeIdMemoized = useMemo<ScopeId>(
        () => scopeId || crypto.randomUUID(),
        [scopeId],
    )

    useInitPanableConfig(scopeIdMemoized, {
        onSelectInit,
        onCanvasClick,
        mode,
        defaultZoom,
        defaultOffset,
    })

    const mouseMove = useCallback(
        (e: MouseEvent) => {
            e.stopPropagation()
            txn(state => onMouseMove(state, e, scopeIdMemoized))
        },
        [scopeIdMemoized],
    )

    const touchMove = useCallback(
        (e: TouchEvent) => {
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
            <EventHandler scopeId={scopeIdMemoized}>
                <InnerCanvas ref={innerRef} scopeId={scopeIdMemoized}>
                    <Selections scopeId={scopeIdMemoized} />
                    {children}
                </InnerCanvas>
            </EventHandler>
            {outerChildren && <>{outerChildren}</>}
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
