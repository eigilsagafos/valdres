import { useIsSelecting } from "../state/hooks/useIsSelecting"
import { useSelectionCoordinates } from "../state/hooks/useSelectionCoordinates"
import type { EventId } from "../types/EventId"

export const Selection = ({ eventId }: { eventId: EventId }) => {
    const { x, y, w, h } = useSelectionCoordinates(eventId)
    const isSelecting = useIsSelecting()

    if (!isSelecting) return null
    return (
        <div
            style={{
                transform: `translate3d(${x}px, ${y}px, 0)`,
                width: `${w}px`,
                height: `${h}px`,
                position: "absolute",
                borderRadius: "2px",
                zIndex: 100,
                border: "1px solid #467EEB",
                backgroundColor: "color-mix(in srgb, #467EEB, transparent 90%)",
            }}
        />
    )
}
