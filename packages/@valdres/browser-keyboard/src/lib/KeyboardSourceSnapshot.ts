import type { KeyboardSnapshot } from "../types/KeyboardSnapshot"
import type { KeyDown } from "../types/KeyDown"

/**
 * The one value the keyboard hub publishes. Held keys and the latest keydown
 * travel together so a store settles once per event and never sees one updated
 * without the other.
 */
export type KeyboardSourceSnapshot = Readonly<{
    keyboard: KeyboardSnapshot
    lastKeyDown: KeyDown | null
}>
