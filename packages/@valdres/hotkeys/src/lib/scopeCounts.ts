import type { Atom } from "valdres"
import type { HotkeyScope } from "../types/HotkeyScope"

/** Each scope's activation-count atom. Kept out of the public object so only
 * `activateHotkeyScope` can change it. */
export const scopeCounts = new WeakMap<HotkeyScope, Atom<number>>()
