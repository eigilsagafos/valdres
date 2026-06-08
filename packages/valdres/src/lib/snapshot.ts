import type { SnapshotEntry } from "../types/SnapshotEntry"
import type { StoreData } from "../types/StoreData"
import { isAtomFamily } from "../utils/isAtomFamily"
import { isSelector } from "../utils/isSelector"
import { isSelectorFamily } from "../utils/isSelectorFamily"

/** Stores already warned about a non-enumerable `snapshot()` call, so the
 *  warning fires at most once per store rather than on every poll. */
const warnedStores = new WeakSet<StoreData>()

/** Accumulate `data`'s materialized entries (and those of every nested scope)
 *  into `out`, reusing `onChange`'s exact filtering: skip `__valdresInternal`
 *  states (e.g. the cacheMeta atom) and family container objects, and classify
 *  each remaining entry as `"atom"` or `"selector"` via `isSelector`. A selector
 *  only appears when it holds a cached value — which, iterating `values`, it
 *  always does. `scope` is the id path from the outermost scope down to `data`. */
const collect = (
    data: StoreData,
    scope: string[],
    out: SnapshotEntry[],
): void => {
    // Only reached for enumerable stores, where `values` is a Map (iterable).
    for (const [state, value] of data.values as Map<WeakKey, unknown>) {
        if ((state as { __valdresInternal?: boolean }).__valdresInternal) continue
        if (isAtomFamily(state) || isSelectorFamily(state)) continue
        out.push({
            type: isSelector(state) ? "selector" : "atom",
            state: state as SnapshotEntry["state"],
            value,
            scope,
        })
    }
    for (const [id, scopeData] of data.scopes) {
        collect(scopeData, [...scope, id], out)
    }
}

/** Materialized current state of `data` and all its (nested) scopes — the
 *  implementation behind `store.snapshot()`. Requires an enumerable store; on a
 *  default (WeakMap) store its values can't be enumerated, so it returns `[]`
 *  and warns once. */
export const snapshot = (data: StoreData): SnapshotEntry[] => {
    if (!data.enumerable) {
        if (!warnedStores.has(data)) {
            warnedStores.add(data)
            console.warn(
                "store.snapshot() requires an enumerable store. Create it with " +
                    "`store(id, { enumerable: true })` to retain state enumerably. " +
                    "Returning [].",
            )
        }
        return []
    }
    const out: SnapshotEntry[] = []
    collect(data, [], out)
    return out
}
