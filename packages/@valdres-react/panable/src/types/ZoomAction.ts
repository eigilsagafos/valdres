export type ZoomAction = {
    kind: "zoom"
    eventId: string | number
    scopeId: string
    initialScale: number
}
