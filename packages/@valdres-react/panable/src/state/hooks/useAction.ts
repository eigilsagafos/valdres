import { useValue } from "valdres-react"
import { actionAtom } from "../atoms/actionAtom"
import type { ScopeId } from "../../types/ScopeId"
import type { EventId } from "../../types/EventId"

export const useAction = (args: { scopeId: ScopeId; eventId: EventId }) =>
    useValue(actionAtom(args))
