import { useIsSelecting } from "../state/hooks/useIsSelecting"
import { useSelectionCoordinates } from "../state/hooks/useSelectionCoordinates"
import type { ScopeId } from "../types/ScopeId"

export const Selection = ({
    eventId,
    scopeId,
}: {
    eventId: string
    scopeId: ScopeId
}) => {
    const { x, y, w, h } = useSelectionCoordinates(eventId, scopeId)
    const isSelecting = useIsSelecting(scopeId)

    if (!isSelecting) return null
    return (
        <div
            style={{
                transform: `translate3d(${x}px, ${y}px, 0)`,
                width: `${w}px`,
                height: `${h}px`,
                position: "absolute",
                borderRadius: "2px",
                zIndex: 2,
                border: "1px solid #467EEB",
                backgroundColor: "color-mix(in srgb, #467EEB, transparent 90%)",
            }}
        />
    )
}
