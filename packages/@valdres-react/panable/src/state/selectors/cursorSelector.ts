import type { CSSProperties } from "react"
import { selectorFamily } from "valdres"
import { type ScopeId } from "../../types/ScopeId"
import { actionAtom } from "../atoms/actionAtom"
import { configAtom } from "../atoms/configAtom"

export const cursorSelector = selectorFamily<ScopeId, CSSProperties["cursor"]>(
    scopeId => get => {
        const { mode } = get(configAtom(scopeId))
        if (mode === "select") return "default"
        const isMouseDragging = get(actionAtom({ eventId: "mouse", scopeId }))
        if (isMouseDragging) return "grabbing"
        return "grab"
    },
    { name: "@valdres-react/panable/cursorSelector" },
)
