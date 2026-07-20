import type { ChangeReport } from "../lib/notifyChangeListeners"

/**
 * Intent for one direct atom write (`store.set` → `setAtom`). A named 1:1
 * replacement for the historical `skipOnSet` boolean whose value is honest
 * naming: "skip" never meant just the hook — it skips commit effects entirely,
 * hooks AND global fan-out ("seed the store locally"). Passed as one of the
 * frozen singletons `DIRECT_WRITE` / `SEED_WRITE` in `lib/commitIntents`.
 */
export type DirectWriteIntent = {
    readonly effects: "run" | "skip"
}

/** Write-phase hook policy for a bulk write: "collect" queues deferred onSets
 *  for the phased slow path; "skip" writes values only. */
export type OnSetPolicy = "collect" | "skip"

/**
 * Intent for a staged bulk write (`setAtoms` — the single-store transaction
 * commit delegate). Collapses the historical implicit `skipOnSet` ×
 * `hasCommitEffects` mode combination into one field, and carries the phase-6
 * delivery target explicitly (undefined = no onChange listener anywhere).
 */
export type BulkWriteIntent = {
    readonly onSet: OnSetPolicy
    readonly report: ChangeReport | undefined
}
