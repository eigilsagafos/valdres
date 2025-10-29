import type { CSSProperties } from "react"
import { selector } from "valdres"
import { actionAtom } from "../atoms/actionAtom"
import { configAtom } from "../atoms/configAtom"

export const cursorSelector = selector<CSSProperties["cursor"]>(
    get => {
        const { mode } = get(configAtom)
        if (mode === "select") return "default"
        const isMouseDragging = get(actionAtom("mouse"))
        if (isMouseDragging) return "grabbing"
        return "grab"
    },
    { name: "@valdres-react/panable/cursorSelector" },
)
