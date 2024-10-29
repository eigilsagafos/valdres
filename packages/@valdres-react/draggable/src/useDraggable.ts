import { useCallback, useEffect, useRef } from "react"
import { useTransaction } from "valdres-react"
import { setIsDragging } from "./sertIsDragging"
import type { EventCallbackFn } from "./types/EventCallbackFn"
import type { Point } from "./types/Point"
import type { Size } from "./types/Size"

export const useDraggable = ({
    meta,
    scopeId,
    onMouseDown,
    onMouseUp,
    onDragStart,
    onDragInit,
    onDragEnd,
    onDrop,
    itemPos,
    itemSize,
    dragEnabled = true,
}: {
    meta: SerializableParam
    scopeId: string
    onMouseDown: (e: React.MouseEvent | React.TouchEvent) => void
    onMouseUp: (e: React.MouseEvent) => void
    onDragStart: EventCallbackFn
    onDragInit: EventCallbackFn
    onDragEnd: EventCallbackFn
    onDrop: EventCallbackFn
    itemPos: Point
    itemSize: Size
    dragEnabled: boolean
}): React.MutableRefObject<any> => {
    const ref = useRef<HTMLDivElement>(null)
    const txn = useTransaction()

    const onMouseDownFn = useCallback(
        (e: MouseEvent) => {
            if (e.button === 2) return
            e.preventDefault()
            e.stopPropagation()
            onMouseDown && onMouseDown(e)

            if (dragEnabled) {
                txn(state => {
                    setIsDragging(state, e.pageX, e.pageY, {
                        eventId: "mouse",
                        scopeId,
                        meta,
                        itemPos,
                        itemSize,
                        onDragStart,
                        onDragInit,
                        onDragEnd,
                        onDrop,
                    })
                })
            }
        },
        [
            onMouseDown,
            scopeId,
            meta,
            itemPos,
            itemSize,
            onDragStart,
            onDragInit,
            onDragEnd,
            onDrop,
        ],
    )

    const onTouchStartFn = useCallback(
        (e: React.TouchEvent) => {
            e.preventDefault()
            e.stopPropagation()
            onMouseDown && onMouseDown(e)
            const t = e.targetTouches[0]
            if (dragEnabled) {
                txn(state => {
                    setIsDragging(state, t.pageX, t.pageY, {
                        eventId: t.identifier,
                        scopeId,
                        meta,
                        itemPos,
                        itemSize,
                        onDragStart,
                        onDragInit,
                        onDragEnd,
                        onDrop,
                    })
                })
            }
        },
        [
            onMouseDown,
            scopeId,
            meta,
            itemPos,
            itemSize,
            onDragStart,
            onDragInit,
            onDragEnd,
            onDrop,
        ],
    )

    const onMouseUpFn = useCallback(
        (e: React.MouseEvent) => {
            if (e.button === 2) return
            onMouseUp && onMouseUp(e)
        },
        [onMouseUp],
    )

    useEffect(() => {
        if (ref?.current) {
            const domElement = ref.current

            domElement.addEventListener("mousedown", onMouseDownFn, {
                passive: false,
            })

            domElement.addEventListener("mouseup", onMouseUpFn, {
                passive: false,
            })

            domElement.addEventListener("touchstart", onTouchStartFn, {
                passive: false,
            })

            return () => {
                domElement?.removeEventListener("mousedown", onMouseDownFn)
                domElement?.removeEventListener("mouseup", onMouseUpFn)
                domElement?.removeEventListener("touchstart", onTouchStartFn)
            }
        }
    }, [])

    return ref
}