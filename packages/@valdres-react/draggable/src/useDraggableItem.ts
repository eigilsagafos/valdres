import { useValue } from "valdres-react"
import { draggableItemAtom } from "./draggableItemAtom"

export const useDraggableItem = (draggableId: any) =>
    useValue(draggableItemAtom(draggableId))
