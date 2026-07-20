import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import type { CommitErrors } from "./commitErrors"
import { recordCommitError } from "./commitErrors"
import { getStoreRuntime } from "./getStoreRuntime"
import { globalOnSetMarker } from "./globalOnSetMarker"

/** A deferred onSet invocation: the atom, written value, and originating store. */
export type DeferredOnSet = [Atom<any>, any, StoreData]

/** Run every hook in insertion order, retaining the first failure. */
export const runOnSets = (onSets: DeferredOnSet[], errors: CommitErrors) => {
    for (const [atom, value, data] of onSets) {
        try {
            if (atom.onSet !== globalOnSetMarker) {
                atom.onSet!(value, getStoreRuntime(data))
            }
        } catch (error) {
            recordCommitError(errors, error)
        }
    }
}
