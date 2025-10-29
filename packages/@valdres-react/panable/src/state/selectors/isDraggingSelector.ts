import { selector } from "valdres"
import { activeActionsAtom } from "../atoms/activeActionsAtom"

export const isDraggingSelector = selector(
    get => get(activeActionsAtom).some(([, kind]) => kind === "drag"),
    { name: "@valdres-react/panable/isDraggingSelector" },
)
