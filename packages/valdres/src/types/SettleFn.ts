import type { ChangeReport } from "../lib/notifyChangeListeners"
import type { NotifyTarget } from "../lib/notifySubscribers"
import type { Atom } from "./Atom"
import type { SettleFlags } from "./SettleFlags"
import type { StoreData } from "./StoreData"

/**
 * The settle composite (phases 4–7 of a commit) as an injectable function:
 * settle affected selectors, deliver subscribers (inline, or collected into
 * `notify` for a deferred multi-pass commit), flush/buffer onChange per
 * `report`, all inside the commit-end boundary. Statically `settleCommit`;
 * passed by reference into the commit engine so the engine never has to import
 * the propagation layer (keeping it out of the core import cycle).
 */
export type SettleFn = (
    atoms: Atom<any>[],
    data: StoreData,
    notify: NotifyTarget | undefined,
    report: ChangeReport | undefined,
    flags: SettleFlags,
) => void
