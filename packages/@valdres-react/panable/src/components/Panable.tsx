import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    type ReactElement,
} from "react"
import {
    useStore,
    useTransaction,
    type TransactionInterface,
} from "valdres-react"
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

export interface PanableComponentArguments {
    width?: string
    height?: string
    defaultZoom?: number
    allowFullscreen?: boolean
    showControls?: boolean
    scopeId?: string
    select?: boolean
    children?: React.ReactNode
    outerChildren?: ReactElement
    backgroundColor?: CSSProperties["backgroundColor"]
    mode: "pan" | "select"
    onCanvasClick?: (txn?: any) => void
    onSelectInit?: (txn: TransactionInterface) => void
}

const useInitPanableConfig = (scopeId: ScopeId, config) => {
    const store = useStore()
    useMemo(() => {
        if (store.data.values.get(configAtom(scopeId)) === undefined) {
            store.data.values.set(configAtom(scopeId), config)
        }
    }, [])
    useEffect(() => {
        store.set(configAtom(scopeId), config)

        console.log("confdig", config)
    }, [config])
}

export const Panable = ({
    width = "100%",
    height = "340px",
    mode = "pan",
    defaultZoom = 0.5,
    allowFullscreen = true,
    showControls = true,
    select = false,
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
