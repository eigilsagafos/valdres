import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { isFamilyAtom } from "../utils/isFamilyAtom"
import { hasChangeListener } from "./notifyChangeListeners"
import { commitRootOf } from "./onCommitEnd"

/** Whether settling one atom needs propagation/reporting machinery. Family
 * members always settle so their membership index remains authoritative. */
export const hasAtomCommitObservers = (
    atom: Atom<any>,
    data: StoreData,
): boolean =>
    isFamilyAtom(atom) ||
    (commitRootOf(data).commitEndListeners?.size ?? 0) !== 0 ||
    hasChangeListener(data) ||
    (data.subscriptions.get(atom)?.size ?? 0) !== 0 ||
    (data.stateDependents.get(atom)?.size ?? 0) !== 0 ||
    (data.inheritedDependencyBranches.get(atom)?.size ?? 0) !== 0
