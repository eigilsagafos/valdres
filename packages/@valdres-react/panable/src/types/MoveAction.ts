export type MoveAction = {
    kind: "move"
    eventId: string | number
    scopeId: string
    initialized: boolean
    initialCameraPosition: {
        x: number
        y: number
    }
    initialMousePosition: {
        x: number
        y: number
    }
}
