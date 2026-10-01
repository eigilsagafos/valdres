import type { Transaction } from "valdres"
import type { HotkeyHit } from "./HotkeyHit"

/**
 * Runs inside the store update the keydown causes, as that update's own
 * transaction. Synchronous; write through `tx` only. Throwing, or returning a
 * promise, discards its writes and is reported.
 */
export type HotkeyCommand = (tx: Transaction, hit: HotkeyHit) => void
