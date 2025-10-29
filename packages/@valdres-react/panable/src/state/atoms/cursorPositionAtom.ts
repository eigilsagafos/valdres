import { atom } from "valdres"
import type { Point } from "../../types/Point"

export const cursorPositionAtom = atom<Point>(
    { x: 0, y: 0 },
    { name: "@valdres-react/panable/cursorPositionAtom" },
)
