import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { isSelector } from "../utils/isSelector"
import { getState } from "./getState"

// Resolve an atom's default for a deleted-member read, mirroring
// getAtomInitValue's resolution order: no-default → suspense placeholder,
// function → call, selector → evaluate, else the plain value. It does NOT do
// getAtomInitValue's async propagation — the caller (getState) owns that via a
// skipFamilyIndexUpdate propagate, so notifying never resurrects the member.
//
// The no-default case must suspend exactly like a fresh member (return a pending
// promise and register a pending-default placeholder so a later set() resolves
// it) rather than returning undefined; and a function default must be run, not
// returned raw. The placeholder registration is a WeakMap entry consumed only by
// resolvePendingDefault on set — it does not register the member in the family
// index, so it never resurrects a deleted member.
export const resolveAtomDefaultValue = <V = any>(
    atom: Atom<V>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
) => {
    if (atom.defaultValue === undefined) {
        let resolve!: (value: any) => void
        const promise = new Promise(r => {
            resolve = r
        })
        data.pendingDefaults.set(atom, { promise, resolve })
        return promise
    } else if (typeof atom.defaultValue === "function") {
        // @ts-ignore @ts-todo
        return atom.defaultValue()
    } else if (isSelector(atom.defaultValue)) {
        return getState(atom.defaultValue, data, initializedAtomsSet)
    }
    return atom.defaultValue
}
