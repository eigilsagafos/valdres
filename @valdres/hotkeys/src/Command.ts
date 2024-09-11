export enum Command {
    Copy = "copy",
    Paste = "paste",
    Cut = "cut",
    Save = "save",
    SelectAll = "select_all",
    ToggleBold = "toggle_bold",
    ToggleItalic = "toggle_italic",
    ToggleUnderline = "toggle_underline",
    ZoomInn = "zoom_inn",
    ZoomOut = "zoom_out",
}

export const MacCommands = {
    [Command.Copy]: "Meta+KeyC",
    [Command.Paste]: "Meta+KeyP",
    [Command.Cut]: "Meta+KeyX",
    [Command.Save]: "Meta+KeyS",
    [Command.SelectAll]: "Meta+KeyA",
    [Command.ToggleBold]: "Meta+KeyB",
    [Command.ToggleItalic]: "Meta+KeyB",
    // [Command.ZoomOut]: "Meta+KeyB",
}
