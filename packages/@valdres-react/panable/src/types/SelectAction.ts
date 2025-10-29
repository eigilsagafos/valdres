import type { Point } from "./Point"

export type SelectAction = {
    kind: "select"
    eventId: string | number
    startPosition: Point
}
