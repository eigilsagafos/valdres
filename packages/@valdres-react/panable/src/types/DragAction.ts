import type { Selector } from "valdres"
import type { EventCallbackFn } from "./EventCallbackFn"
import type { EventId } from "./EventId"
import type { Point } from "./Point"
import type { Size } from "./Size"

export type DragAction<Meta = any> = {
    kind: "drag"
    id: any
    eventId: EventId
    initialized: boolean
    meta?: Meta
    itemPos: () => Point
    itemSize: () => Size
    initialMousePosition: {
        x: number
        y: number
    }
    mouseOffset: {
        x: number
        y: number
    }
    onDragStart?: EventCallbackFn
    onDragEnd?: EventCallbackFn
    onDrop?: EventCallbackFn
    activeDropzone?: any
    dropzonesSelector: Selector
    event: any
}
