import { atom } from "valdres"
import type { ActionKind } from "../../types/ActionKind"
import type { EventId } from "../../types/EventId"

export const activeActionsAtom = atom<[EventId, ActionKind][]>([], {
    name: "@valdres-react/panable/activeActionsAtom",
})
