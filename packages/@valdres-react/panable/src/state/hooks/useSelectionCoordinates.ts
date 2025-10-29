import { useValue } from "valdres-react"
import type { EventId } from "../../types/EventId"
import { selectionCoordinatesSelector } from "../selectors/selectionCoordinatesSelector"

export const useSelectionCoordinates = (eventId: EventId) =>
    useValue(selectionCoordinatesSelector(eventId))
