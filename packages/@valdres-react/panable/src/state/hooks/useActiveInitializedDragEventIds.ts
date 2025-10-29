import { useValue } from "valdres-react"
import { activeInitializedDragEventIds } from "../selectors/activeInitializedDragEventIds"

export const useActiveInitializedDragEventIds = () =>
    useValue(activeInitializedDragEventIds)
