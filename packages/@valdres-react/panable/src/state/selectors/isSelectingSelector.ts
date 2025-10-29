import { selector } from "valdres"
import { activeActionsAtom } from "../atoms/activeActionsAtom"
import { selectionCoordinatesSelector } from "./selectionCoordinatesSelector"

export const isSelectingSelector = selector<boolean>(
    get => {
        const eventId = get(activeActionsAtom).find(
            ([, kind]) => kind === "select",
        )?.[0]

        if (eventId) {
            const { w, h } = get(selectionCoordinatesSelector(eventId))

            if (w > 3 || h > 3) {
                return true
            }
        }

        return false
    },
    { name: "@valdres-react/panable/isSelectingSelector" },
)
