import { selectorFamily } from "valdres-react"
import { activeActionsAtom } from "../atoms/activeActionsAtom"
import { selectionCoordinatesSelector } from "./selectionCoordinatesSelector"
import type { ScopeId } from "../../types/ScopeId"

export const isSelectingSelector = selectorFamily<ScopeId, boolean>(
    scopeId => get => {
        const eventId = get(activeActionsAtom(scopeId)).find(
            ([, kind]) => kind === "select",
        )?.[0]

        if (eventId) {
            const { w, h } = get(
                selectionCoordinatesSelector({
                    eventId,
                    scopeId,
                }),
            )

            if (w > 3 || h > 3) {
                return true
            }
        }

        return false
    },
    { name: "@valdres-react/panable/isSelectingSelector" },
)
