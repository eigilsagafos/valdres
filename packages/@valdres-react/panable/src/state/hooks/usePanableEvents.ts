import { useCallback, useEffect, useRef } from "react"
import { useTransaction } from "valdres-react"
import { onMouseDown } from "../actions/onMouseDown"
import { onMouseUp } from "../actions/onMouseUp"
import { onTouchEnd } from "../actions/onTouchEnd"
import { onTouchStart } from "../actions/onTouchStart"
import { zoom } from "../actions/zoom"
import { moveDelta } from "../actions/moveDelta"
// import { useCurrentCapabilities } from "../../../state/hooks/useCurrentCapabilities"

export const usePanableEvents = ({ scopeId, select, onCanvasClick }) => {
    const txn = useTransaction()
    const ref = useRef<HTMLDivElement>()

    // const capabilities = useCurrentCapabilities()
    const onWheel = useCallback(
        e => {
            e.stopPropagation()

            if (e.ctrlKey) {
                e.preventDefault()
                txn(state => zoom(state, e.deltaY, scopeId))
            } else {
                e.preventDefault()
                txn(state => moveDelta(state, e.deltaX, e.deltaY, scopeId))
                // throw new Error(`TODO`)
                // if (
                //     capabilities.actions.pan.enabled &&
                //     capabilities.actions.pan.gestures
                // ) {
                //     txn(state => moveDelta(state, e.deltaX, e.deltaY, scopeId))
                // }
            }
        },
        [scopeId],
    )

    const mouseDown = useCallback(
        e => {
            txn(state => onMouseDown(state, e, scopeId, select))
        },
        [scopeId, select],
    )

    const mouseUp = useCallback(
        e => {
            e.preventDefault()
            e.stopPropagation()
            txn(state => onMouseUp(state, e, scopeId, onCanvasClick))
        },
        [scopeId],
    )

    const touchStart = useCallback(
        e => {
            e.preventDefault()
            e.stopPropagation()
            txn(state => onTouchStart(state, e, scopeId, select))
        },
        [scopeId, select],
    )

    const touchEnd = useCallback(
        e => {
            e.preventDefault()
            e.stopPropagation()
            txn(state => onTouchEnd(state, e, scopeId, onCanvasClick))
        },
        [scopeId],
    )

    useEffect(() => {
        if (ref?.current) {
            const domElement = ref?.current

            domElement.addEventListener("wheel", onWheel, {
                passive: false,
            })

            domElement.addEventListener("mousedown", mouseDown, {
                passive: false,
            })

            domElement.addEventListener("mouseup", mouseUp, {
                passive: false,
            })

            domElement.addEventListener("touchstart", touchStart, {
                passive: false,
            })
            domElement.addEventListener("touchend", touchEnd, {
                passive: false,
            })

            document.addEventListener("mouseup", mouseUp, {
                passive: false,
            })

            return () => {
                domElement?.removeEventListener("wheel", onWheel)
                domElement?.removeEventListener("mousedown", mouseDown)
                domElement?.removeEventListener("mouseup", mouseUp)
                document.removeEventListener("mouseup", mouseUp)
                domElement?.removeEventListener("touchstart", touchStart)
                domElement?.removeEventListener("touchend", touchEnd)
            }
        }
    }, [scopeId, select, mouseDown, mouseUp, onWheel])

    return ref
}
