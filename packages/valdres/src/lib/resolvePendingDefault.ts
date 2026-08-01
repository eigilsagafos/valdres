import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"

/** Resolve any outstanding pending-default suspense placeholder for `atom`
 *  with `value` and remove it. The placeholder may have been registered in a
 *  parent store (atoms with no `defaultValue` init in whichever scope first
 *  reads them, which `getState` resolves by walking up to root), so we walk
 *  the scope chain rather than only checking `data`.
 *
 *  Called by every write path that lands a value on an atom that may carry a
 *  placeholder — `setAtom` (sync + async resolve) and `writeAtoms` (the
 *  transaction path).
 *
 *  Caller contract: pass a SETTLED value, never a promise. The placeholder must
 *  resolve to the eventual real value, so an in-flight promise stored
 *  mid-sequence must not consume it — a later settled write still has to find
 *  the entry here. `setAtom` guarantees this by routing promises through
 *  `handlePromise` instead; `writeAtoms` by gating on `!isPromiseLike(value)`.
 *
 *  Optional optimization (not required): a caller that already knows the prior
 *  value may skip the call when it isn't promise-like — a placeholder is always
 *  stored as a promise, so a non-promise prior value can't have one. `writeAtoms`
 *  does this (gating on `isPromiseLike(currentValue)`) to keep the write hot
 *  path off this function. `setAtom` calls unconditionally; the walk is a couple
 *  of WeakMap lookups that bail immediately when there's nothing to resolve.
 *
 *  Idempotent and commit-safe: the entry is deleted on first resolve and a
 *  settled promise ignores later `resolve` calls, so calling this from more
 *  than one store pass in a single cross-scope commit is harmless. `resolve`
 *  only schedules the placeholder's `.then` microtasks — it runs no subscriber
 *  code synchronously — so calling it during a transaction's write phase
 *  cannot expose a half-applied commit. */
/** The suspense placeholder still outstanding for `atom`, if any, found by the
 *  SAME scope-chain walk `resolvePendingDefault` uses to resolve it.
 *
 *  Re-initialization must hand back this promise rather than minting a fresh
 *  one: `pendingDefaults` is a WeakMap keyed by the atom, so a second
 *  placeholder REPLACES the first, and the reader already suspended on it could
 *  never be resolved by any later write. That is reachable whenever a store's
 *  own value is removed while a placeholder is live — `unset`, or `reset` on an
 *  atom with no default — after which the next read re-inits.
 *
 *  Keeping the two walks identical is the invariant: whichever entry this
 *  returns is exactly the entry a later `resolvePendingDefault` will settle.
 *  Today's re-init paths land in the same store that holds the entry, so the
 *  local hit is the one that fires; the walk is there so a re-init from a
 *  descendant (a scoped read of a deleted family member, say) can't mint a
 *  competing entry that the resolver would then settle in its place. */
export const pendingDefaultPromise = (
    atom: Atom<any>,
    data: StoreData,
): Promise<any> | undefined => {
    let cur: StoreData | undefined = data
    while (cur) {
        const entry = cur.pendingDefaults.get(atom)
        if (entry) return entry.promise
        cur = "parent" in cur ? cur.parent : undefined
    }
    return undefined
}

export const resolvePendingDefault = <Value>(
    atom: Atom<Value>,
    data: StoreData,
    value: Value,
) => {
    let cur: StoreData | undefined = data
    while (cur) {
        const entry = cur.pendingDefaults.get(atom)
        if (entry) {
            entry.resolve(value)
            cur.pendingDefaults.delete(atom)
            return
        }
        cur = "parent" in cur ? cur.parent : undefined
    }
}
