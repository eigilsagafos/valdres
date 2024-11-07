import { atomFamily } from "valdres-react"
import type { ScopeId } from "../../types/ScopeId"

export const cameraPositionAtom = atomFamily<
    ScopeId,
    { x: number; y: number; default?: boolean; animate?: boolean }
>(
    { x: 100, y: 0, animate: false },
    {
        name: "@valdres-react/panable/cameraPosition",
    },
)
