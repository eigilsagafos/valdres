import type { KeyboardCommand } from "../../types/KeyboardCommand"

export const pcCommandMappings: { [key in KeyboardCommand]: string } = {
    Save: "Control+s",
    Undo: "Control+z",
    Redo: "Control+y",
    Cut: "Control+x",
    Copy: "Control+c",
    ZoomIn: "Control+=",
    ZoomOut: "Control+-",
    ZoomReset: "Control+0",
}
