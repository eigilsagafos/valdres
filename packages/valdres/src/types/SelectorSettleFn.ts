import type { ChangeReport } from "../lib/notifyChangeListeners"
import type { Selector } from "./Selector"
import type { StoreData } from "./StoreData"

/** Native async-selector resolution settlement: recompute and notify only the
 * selector's downstream graph, then report the resolving selector with it. */
export type SelectorSettleFn = (
    selector: Selector<any>,
    data: StoreData,
    report: ChangeReport | undefined,
) => void
