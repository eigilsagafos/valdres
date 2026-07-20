import type { BulkWriteIntent, DirectWriteIntent } from "../types/CommitIntent"
import type { SettleFlags } from "../types/SettleFlags"

/**
 * Frozen intent/flag singletons for the commit engine. Every hot-path write
 * passes one of these shared consts — never a per-call object — so intent
 * typing costs zero allocation, and every `SettleFlags` ever constructed shares
 * one field order (one hidden class) to keep `settleCommit`'s flag loads
 * monomorphic. Freezing guards the shared instances against accidental
 * mutation; construction goes through the single `flags` factory below.
 *
 * This module deliberately has zero runtime imports so it can never join the
 * core write-path import cycle (see test/import-cycles).
 */

/** Ordinary `store.set`: hooks and global fan-out participate. */
export const DIRECT_WRITE: DirectWriteIntent = Object.freeze({ effects: "run" })

/** Seed a store's own value only (atom `onInit` setSelf, including global
 *  atoms' local seeding): skips onSet hooks AND global fan-out — the exact
 *  semantics the historical `skipOnSet=true` flag carried. */
export const SEED_WRITE: DirectWriteIntent = Object.freeze({ effects: "skip" })

/** Bulk write with deferred onSet/global handling, no onChange listener. */
export const BULK_WITH_EFFECTS_SILENT: BulkWriteIntent = Object.freeze({
    onSet: "collect",
    report: undefined,
})

/** Bulk write with no staged hooks anywhere, no onChange listener. */
export const BULK_NO_EFFECTS_SILENT: BulkWriteIntent = Object.freeze({
    onSet: "skip",
    report: undefined,
})

const flags = (
    isInitOnly: boolean,
    skipFamilyIndexUpdate: boolean,
    reportAtoms: boolean,
): SettleFlags =>
    Object.freeze({ isInitOnly, skipFamilyIndexUpdate, reportAtoms })

/** The ordinary settle: observers report, family index maintained. */
export const SETTLE_DEFAULT = flags(false, false, true)

/** Unset settle: only recomputed selectors report; the caller already emitted
 *  the trigger atoms as `kind: "unset"`. */
export const SETTLE_UNSET = flags(false, false, false)

/** Deleted-member async-default settle (see getState): dependents observe the
 *  resolved value without the member being resurrected in the family index. */
export const SETTLE_SKIP_FAMILY_INDEX = flags(false, true, true)

/** Initialization-only settle: no observer reporting. */
export const SETTLE_INIT_ONLY = flags(true, false, true)

/**
 * TOTAL mapping of the 3-bit flag space onto shared frozen consts, for the
 * legacy positional `propagateAtomUpdate` adapter:
 * index = (isInitOnly ? 4 : 0) | (skipFamilyIndexUpdate ? 2 : 0) | (reportAtoms ? 1 : 0).
 * Totality is the point — no positional combination can be silently coerced to
 * a different one, and no combination ever allocates. The four unnamed entries
 * have no current caller but must exist so the mapping stays total.
 */
export const SETTLE_FLAGS_BY_BITS: readonly SettleFlags[] = Object.freeze([
    SETTLE_UNSET, // 000
    SETTLE_DEFAULT, // 001
    flags(false, true, false), // 010 (no current caller)
    SETTLE_SKIP_FAMILY_INDEX, // 011
    flags(true, false, false), // 100 (no current caller)
    SETTLE_INIT_ONLY, // 101
    flags(true, true, false), // 110 (no current caller)
    flags(true, true, true), // 111 (no current caller)
])
