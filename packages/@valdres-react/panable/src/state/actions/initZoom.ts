import type { Transaction } from "valdres"
import { actionAtom } from "../atoms/actionAtom"
import { activeActionsAtom } from "../atoms/activeActionsAtom"
import { scaleAtom } from "../atoms/scaleAtom"

export const initZoom = (txn: Transaction, t1: Touch, t2: Touch) => {
    const id1 = t1.identifier
    const id2 = t2.identifier
    txn.set(activeActionsAtom, curr => [
        ...curr,
        [t1.identifier, "zoom"],
        [t2.identifier, "zoom"],
    ])
    const initialScale = txn.get(scaleAtom)
    txn.set(actionAtom(id1), {
        kind: "zoom",
        eventId: id1,
        initialScale,
    })
    txn.set(actionAtom(id2), {
        kind: "zoom",
        eventId: id2,
        initialScale,
    })
}
