import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { isFamilyAtom } from "../utils/isFamilyAtom"
import { changeListenerRegistry } from "./notifyChangeListeners"
import { commitEndRegistry } from "./onCommitEnd"

/** Whether settling one atom needs propagation/reporting machinery. Family
 * members always settle so their membership index remains authoritative. */
export const hasAtomCommitObservers = (
    atom: Atom<any>,
    data: StoreData,
): boolean =>
    isFamilyAtom(atom) ||
    commitEndRegistry.count !== 0 ||
    changeListenerRegistry.count !== 0 ||
    (data.subscriptions.get(atom)?.size ?? 0) !== 0 ||
    (data.stateDependents.get(atom)?.size ?? 0) !== 0 ||
    (data.inheritedDependencyBranches.get(atom)?.size ?? 0) !== 0
