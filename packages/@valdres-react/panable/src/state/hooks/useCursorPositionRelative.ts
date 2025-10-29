import { useValue } from "valdres-react"
import { cursorPositionRelativeSelector } from "../selectors/cursorPositionRelativeSelector"

export const useCursorPositionRelative = (innerCanvas: boolean = false) =>
    useValue(cursorPositionRelativeSelector(innerCanvas))
