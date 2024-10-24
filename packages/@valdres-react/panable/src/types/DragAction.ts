export type DragAction<Meta = any> = {
    kind: "drag"
    eventId: string | number
    scopeId: string
    initialized: boolean
    x: number
    y: number
    meta?: Meta
    onDragEnd?: any
}
