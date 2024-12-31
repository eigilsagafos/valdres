import type { TransactionInterface } from "valdres"
import type { ScopeId } from "../../types/ScopeId"
import { actionAtom } from "../atoms/actionAtom"
import { activeActionsAtom } from "../atoms/activeActionsAtom"
import { scaleAtom } from "../atoms/scaleAtom"

export const initZoom = (
    txn: TransactionInterface,
    scopeId: ScopeId,
    t1: Touch,
    t2: Touch,
) => {
    const id1 = t1.identifier
    const id2 = t2.identifier
    txn.set(activeActionsAtom(scopeId), curr => [
        ...curr,
        [t1.identifier, "zoom"],
        [t2.identifier, "zoom"],
    ])
    const initialScale = txn.get(scaleAtom(scopeId))
    txn.set(actionAtom({ eventId: id1, scopeId }), {
        kind: "zoom",
        eventId: id1,
        scopeId,
        initialScale,
    })
    txn.set(actionAtom({ eventId: id2, scopeId }), {
        kind: "zoom",
        eventId: id2,
        scopeId,
        initialScale,
    })
}
