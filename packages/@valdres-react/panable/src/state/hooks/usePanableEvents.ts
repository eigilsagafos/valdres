import { useCallback, useEffect, useRef } from "react"
import { useStore } from "valdres-react"
import { moveDelta } from "../actions/moveDelta"
import { onMouseDown } from "../actions/onMouseDown"
import { onMouseUp } from "../actions/onMouseUp"
import { onTouchEnd } from "../actions/onTouchEnd"
import { onTouchStart } from "../actions/onTouchStart"
import { zoom } from "../actions/zoom"

export const usePanableEvents = () => {
    const store = useStore()
    const ref = useRef<HTMLDivElement>()

    const onWheel = useCallback((e: WheelEvent) => {
        e.stopPropagation()

        if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            zoom(store, e.deltaY)
        } else {
            e.preventDefault()
            moveDelta(store, e.deltaX, e.deltaY)
        }
    }, [])

    const mouseDown = useCallback((e: MouseEvent) => {
        onMouseDown(store, e)
    }, [])

    const mouseUp = useCallback((e: MouseEvent) => {
        e.stopPropagation()
        onMouseUp(store, e)
    }, [])

    const touchStart = useCallback((e: TouchEvent) => {
        e.preventDefault()
        e.stopPropagation()
        onTouchStart(store, e)
    }, [])

    const touchEnd = useCallback((e: TouchEvent) => {
        e.preventDefault()
        e.stopPropagation()
        onTouchEnd(store, e)
    }, [])

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
    }, [mouseDown, mouseUp, onWheel])

    return ref
}
