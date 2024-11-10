import { atomFamily } from "valdres"
import type { ScopeId } from "../../types/ScopeId"
import type { Point } from "../../types/Point"

export const cursorPositionAtom = atomFamily<ScopeId, Point>(
    { x: 0, y: 0 },
    {
        name: "@valdres-react/panable/cursorPositionAtom",
    },
)
