import { useValue } from "valdres-react"
import type { EventId } from "../../types/EventId"
import { actionAtom } from "../atoms/actionAtom"

export const useAction = (eventId: EventId) => useValue(actionAtom(eventId))
