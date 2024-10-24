import { useValue } from "valdres-react"
import { selectionCoordinatesSelector } from "../selectors/selectionCoordinatesSelector"
import type { EventId } from "../../types/EventId"
import type { ScopeId } from "../../types/ScopeId"

export const useSelectionCoordinates = (eventId: EventId, scopeId: ScopeId) =>
    useValue(selectionCoordinatesSelector({ eventId, scopeId }))
