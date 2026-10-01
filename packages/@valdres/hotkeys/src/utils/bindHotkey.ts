import type { Store } from "valdres"
import { parseShortcuts } from "../lib/parseShortcut"
import { registerBinding, type BindingConfig } from "../lib/registry"
import type { HotkeyCommand } from "../types/HotkeyCommand"
import type { HotkeyOptions } from "../types/HotkeyOptions"

/**
 * Runs `command` inside the store update of each new keydown that matches
 * `shortcut` (or any alternative in an array) while this binding is the one
 * eligible binding of highest rank in `store`. Never runs for a keydown from
 * before this call. Returns an idempotent disposer.
 */
export const bindHotkey = (
    store: Store,
    shortcut: string | readonly string[],
    command: HotkeyCommand,
    options: HotkeyOptions = {},
): (() => void) => {
    const config: BindingConfig = Object.freeze({ ...options, command })
    return registerBinding(store, parseShortcuts(shortcut), () => config)
        .dispose
}
