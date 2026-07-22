import type { CommitErrors } from "../lib/commitErrors"
import type { StoreAtomUpdates } from "../lib/globalAtomFanOut"
import type { ChangeReport } from "../lib/notifyChangeListeners"
import type { Atom } from "./Atom"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { StoreChangeSource } from "./StoreChangeSource"
import type { StoreData } from "./StoreData"

/** One store's finalized local slot in a multi-root commit forest. Global peer
 * updates are folded into the canonical node for the same StoreData by the
 * forest settlement before any graph work begins. */
export type CommitForestEntry = {
    data: StoreData
    updatedAtoms: Atom<any>[]
    deleted: AtomFamilyAtom<any, any>[] | undefined
    unsetAtoms: Atom<any>[] | undefined
    children: CommitForestEntry[] | undefined
}

/** Settle a logical commit spanning one or more independent store trees. Every
 * physical StoreData is canonicalized to one sparse-forest node and visited
 * once with the union of local, inherited, and global trigger groups. */
export type CommitForestSettleFn = (
    entries: CommitForestEntry[],
    globalUpdates: StoreAtomUpdates | undefined,
    globalSource: StoreChangeSource | undefined,
    report: ChangeReport | undefined,
    errors: CommitErrors,
) => void
