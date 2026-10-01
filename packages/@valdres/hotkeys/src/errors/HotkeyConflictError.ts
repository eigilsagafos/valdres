import type { KeyDown } from "@valdres/browser-keyboard"

/**
 * Two or more bindings in one store were equally eligible for a keydown — same
 * scope priority and same binding priority — so none ran and the keydown was
 * not cancelled. Reported from the store update, like any failing handler.
 */
export class HotkeyConflictError extends Error {
    readonly keyDown: KeyDown
    /** Canonical shortcuts of the tied bindings, in no particular order. */
    readonly shortcuts: readonly string[]

    constructor(keyDown: KeyDown, shortcuts: readonly string[]) {
        super(
            `${shortcuts.length} hotkeys are equally eligible for ${keyDown.code} (${shortcuts.join(", ")}); none ran. Give them different priorities or scopes, or make all but one ineligible.`,
        )
        this.name = "HotkeyConflictError"
        this.keyDown = keyDown
        this.shortcuts = Object.freeze([...shortcuts])
    }
}
