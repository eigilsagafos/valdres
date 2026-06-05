import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"

/** Resolve any outstanding pending-default suspense placeholder for `atom`
 *  and remove it. The placeholder may have been registered in a parent
 *  store (atoms with no `defaultValue` init in whichever scope first reads
 *  them, which `getState` resolves by walking up to root), so we walk the
 *  scope chain rather than only checking `data`.
 *
 *  Every write path that lands a real value on an atom that may have a
 *  suspense placeholder must call this — `setAtom` (sync + async resolve)
 *  and `writeAtoms` (the transaction path). Callers should gate on
 *  `isPromiseLike(currentValue)`: a placeholder is always stored as a
 *  promise, so a non-promise current value means there is nothing to
 *  resolve and the chain walk can be skipped. */
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
