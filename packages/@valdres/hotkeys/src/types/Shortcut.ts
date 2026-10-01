import type { Modifier } from "@valdres/browser-keyboard"

/** One parsed shortcut. Internal: the public API takes shortcut strings. */
export type Shortcut = Readonly<{
    /** Canonical text, e.g. `"Ctrl+Shift+z"`; equal for every spelling. */
    id: string
    /** Matches `KeyDown.code` exactly. */
    trigger: string
    /** Matches `KeyDown.key`, lowercased. */
    key: string
    modifiers: Readonly<Record<Modifier, boolean>>
    /** The trigger is a shifted symbol such as `?`, so Shift is not compared. */
    ignoreShift: boolean
}>
