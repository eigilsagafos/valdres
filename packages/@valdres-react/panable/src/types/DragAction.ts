import type { Selector } from "../../../../valdres/src/types/Selector"
import type { EventCallbackFn } from "../../../draggable/types/EventCallbackFn"
import type { Size } from "../../../draggable/types/Size"
import type { EventId } from "./EventId"
import type { Point } from "./Point"

export type DragAction<Meta = any> = {
    kind: "drag"
    id: any
    eventId: EventId
    initialized: boolean
    meta?: Meta
    originPosition: Point | (() => Point)
    originSize: Size | (() => Size)
    initialCameraPosition: {
        x: number
        y: number
    }
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
