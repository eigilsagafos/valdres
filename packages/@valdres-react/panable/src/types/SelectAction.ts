import type { Point } from "./Point"

export type SelectAction = {
    kind: "select"
    eventId: string | number
    scopeId: string
    startPosition: Point
}
