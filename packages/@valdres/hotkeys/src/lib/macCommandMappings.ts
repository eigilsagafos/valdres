import type { KeyboardCommand } from "../types/KeyboardCommand"

export const macCommandMappings: { [key in KeyboardCommand]: string } = {
    Save: "Meta+s",
    Undo: "Meta+z",
    Redo: "Shift+Meta+z",
    Cut: "Meta+x",
    Copy: "Meta+C",
    ZoomIn: "Meta+=",
    ZoomOut: "Meta+-",
    ZoomReset: "Meta+0",
}
