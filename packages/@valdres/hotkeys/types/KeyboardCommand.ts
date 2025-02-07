export const keyboardCommands = [
    "Save",
    "Undo",
    "Redo",
    "Cut",
    "Copy",
    "ZoomIn",
    "ZoomOut",
    "ZoomReset",
] as const

export type KeyboardCommand = (typeof keyboardCommands)[number]
