import { atomFamily } from "valdres"

const DEFAULT_VALUE = Object.freeze({
    isSnapping: false,
    isDragging: false,
    x: 0,
    y: 0,
})

export const draggableItemAtom = atomFamily<
    any,
    { isSnapping: boolean; isDragging: boolean; x: number; y: number }
>(DEFAULT_VALUE, { name: "@valdres-react/draggable/draggableItemAtom" })
