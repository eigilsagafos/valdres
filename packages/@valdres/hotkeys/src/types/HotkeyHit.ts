import type { KeyDown } from "@valdres/browser-keyboard"

export type HotkeyHit = Readonly<{
    /** The keydown being handled. */
    keyDown: KeyDown
    /** Canonical form of the alternative that matched, e.g. `"Meta+s"`. */
    shortcut: string
}>
